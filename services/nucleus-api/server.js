require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { prisma } = require('database');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 61443;
console.log(`[*] Nucleus REST API initializing...`);

// 1. Get ONLY Active Servers (Now includes latest telemetry!)
app.get('/api/v1/servers', async (req, res) => {
    try {
        const servers = await prisma.managedServer.findMany({
            where: { is_active: true },
            orderBy: { hostname: 'asc' },
            // NEW: Grab the single most recent telemetry log for the card UI
            include: {
                telemetry: {
                    orderBy: { recorded_at: 'desc' },
                    take: 1
                }
            }
        });
        res.json(servers);
    } catch (error) {
        console.error("[-] Database error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2. Update Server Metadata & Intervals
app.put('/api/v1/servers/:id/metadata', async (req, res) => {
    try {
        const { id } = req.params;
        const { alias, group_name, heartbeat_interval, telemetry_interval, user } = req.body;

        const updated = await prisma.managedServer.update({
            where: { server_id: id },
            data: { 
                alias, 
                group_name,
                heartbeat_interval: parseInt(heartbeat_interval),
                telemetry_interval: parseInt(telemetry_interval)
            }
        });

        await prisma.auditLog.create({
            data: {
                server_id: id,
                action: "UPDATE_CONFIG",
                details: `Heartbeat: ${heartbeat_interval}s, Telemetry: ${telemetry_interval}s`,
                performed_by: user || "admin"
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: "Failed to update metadata" });
    }
});

// 3. Soft Delete a Server
app.delete('/api/v1/servers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { user } = req.body;

        await prisma.managedServer.update({
            where: { server_id: id },
            data: { is_active: false, status: "DECOMMISSIONED" }
        });

        await prisma.auditLog.create({
            data: {
                server_id: id,
                action: "DECOMMISSION_SERVER",
                details: "Server logically deleted and hidden from dashboard",
                performed_by: user || "admin"
            }
        });

        res.json({ success: true, message: "Server decommissioned securely." });
    } catch (error) {
        res.status(500).json({ error: "Decommission failed" });
    }
});

// 4. Get Telemetry (Chart Data)
app.get('/api/v1/servers/:id/telemetry', async (req, res) => {
    try {
        const range = req.query.range || '1h';
        let cutoff = new Date();

        if (range === '1h') cutoff.setHours(cutoff.getHours() - 1);
        else if (range === '24h') cutoff.setHours(cutoff.getHours() - 24);
        else if (range === '30d') cutoff.setDate(cutoff.getDate() - 30);
        else if (range === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);

        // 1. Fetch the chronological data (capped at 5000 rows to prevent API memory crashes)
        const rawHistory = await prisma.telemetryLog.findMany({
            where: { 
                server_id: req.params.id,
                recorded_at: { gte: cutoff }
            },
            orderBy: { recorded_at: 'asc' }, 
            take: 5000 
        });
        
        // 2. The Architectural Approach: UI-Optimized Downsampling
        const TARGET_UI_POINTS = 96; 
        
        // If we have less data than the target, just return it as-is
        if (rawHistory.length <= TARGET_UI_POINTS) {
            return res.json(rawHistory);
        }

        // Calculate the exact step interval needed to crush the array down to 96 points
        const step = Math.ceil(rawHistory.length / TARGET_UI_POINTS);
        const downsampledHistory = rawHistory.filter((_, index) => index % step === 0);

        // Ensure the absolute newest, most current data point is always on the graph
        const lastRawPoint = rawHistory[rawHistory.length - 1];
        if (downsampledHistory[downsampledHistory.length - 1].id !== lastRawPoint.id) {
            downsampledHistory.push(lastRawPoint);
        }

        res.json(downsampledHistory);
    } catch (error) {
        console.error("[-] Telemetry fetch error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

app.listen(PORT, () => console.log(`[*] API Online on port ${PORT}`));
