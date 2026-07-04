require('dotenv').config();
const { WebSocketServer } = require('ws');
const { prisma } = require('database');

const PORT = 61033;
const wss = new WebSocketServer({ port: PORT });

console.log(`[*] Nucleus Gateway initializing on port ${PORT}...`);

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const payload = JSON.parse(message);
            
            const serverConfig = await prisma.managedServer.findUnique({
                where: { server_id: payload.server_id }
            });

            if (serverConfig && !serverConfig.is_active) return; // Drop soft-deleted

            // 1. ALWAYS Update Last Seen and Capacity Specs (for both Heartbeat and Telemetry)
            const updatedServer = await prisma.managedServer.upsert({
                where: { server_id: payload.server_id },
                update: { 
                    ip_address: payload.ipv4_address, 
                    last_seen_at: new Date(), 
                    status: "ONLINE",
                    os_release: payload.os_release, // <--- I FORGOT THIS LINE
                    total_cores: payload.total_cores,
                    total_ram_gb: payload.total_ram_gb,
                    total_disk_gb: payload.total_disk_gb
                },
                create: {
                    server_id: payload.server_id,
                    hostname: payload.hostname,
                    ip_address: payload.ipv4_address,
                    os_release: payload.os_release,
                    total_cores: payload.total_cores,
                    total_ram_gb: payload.total_ram_gb,
                    total_disk_gb: payload.total_disk_gb
                }
            });

            // 2. ONLY Insert Database rows if payload is TELEMETRY
            if (payload.payload_type === "TELEMETRY") {
                await prisma.telemetryLog.create({
                    data: {
                        server_id: payload.server_id,
                        cpu_usage_pct: payload.cpu_usage_pct,
                        ram_usage_pct: payload.ram_usage_pct,
                        swap_usage_pct: payload.swap_usage_pct,
                        storage_root_pct: payload.storage_root_pct,
                        top_processes: payload.top_processes
                    }
                });
                console.log(`[~] Heavy Telemetry Written: ${payload.hostname}`);
            }

            // 3. THE MAGIC: Push the exact configuration back down the tunnel
            ws.send(JSON.stringify({
                type: "CONFIG_SYNC",
                heartbeat_interval: updatedServer.heartbeat_interval,
                telemetry_interval: updatedServer.telemetry_interval
            }));

        } catch (err) {
            console.error(`[-] Processing error: ${err.message}`);
        }
    });
});

// --- DYNAMIC WATCHDOG SWEEPER ---
setInterval(async () => {
    try {
        const activeServers = await prisma.managedServer.findMany({ where: { status: "ONLINE" }});
        let deadCount = 0;

        for (const srv of activeServers) {
            // Cutoff is their custom heartbeat interval + a 5 second grace period
            const cutoffTime = new Date(Date.now() - ((srv.heartbeat_interval + 5) * 1000));
            
            if (srv.last_seen_at < cutoffTime) {
                await prisma.managedServer.update({
                    where: { server_id: srv.server_id },
                    data: { status: "OFFLINE" }
                });
                deadCount++;
            }
        }
        if (deadCount > 0) console.log(`[!] Watchdog: Marked ${deadCount} nodes OFFLINE.`);
    } catch (error) {
        console.error("[-] Sweeper error:", error.message);
    }
}, 5000);