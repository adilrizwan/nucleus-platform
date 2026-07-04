import asyncio
import websockets
import json
import psutil
import platform
import uuid
import os
import socket

GATEWAY_URL = "ws://127.0.0.1:61033"
ID_FILE = ".quark_id"

SYS_INFO = {}
queue = asyncio.Queue()

# DYNAMIC CONFIGURATION (Overwritten by Gateway)
CONFIG = {
    "heartbeat": 10,
    "telemetry": 300
}

def resolve_ipv4():
    """Discovers the true outbound IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def get_os_name():
    """Parses /etc/os-release for the human-readable Linux distro name."""
    try:
        with open("/etc/os-release", "r") as f:
            for line in f:
                if line.startswith("PRETTY_NAME="):
                    # Extracts the value and strips quotes/newlines
                    return line.split("=")[1].strip().strip('"\'')
    except FileNotFoundError:
        pass
    
    # Fallback to kernel string for Windows/macOS or non-standard systems
    return f"{platform.system()} {platform.release()}"

def initialize_identity():
    """Initializes identity and gathers static hardware/OS details."""
    global SYS_INFO
    if os.path.exists(ID_FILE):
        with open(ID_FILE, 'r') as f: server_id = f.read().strip()
    else:
        server_id = str(uuid.uuid4())
        with open(ID_FILE, 'w') as f: f.write(server_id)

    SYS_INFO = {
        "server_id": server_id,
        "hostname": platform.node(),
        "os_release": get_os_name(),  # <--- Now uses the new parsing function
        "ipv4_address": resolve_ipv4(),
        "total_cores": psutil.cpu_count(logical=True),
        "total_ram_gb": round(psutil.virtual_memory().total / (1024 ** 3), 2),
        "total_disk_gb": round(psutil.disk_usage('/').total / (1024 ** 3), 2)
    }

# --- WORKER 1: Periodically communicates heartbeat to the gateway ---
async def heartbeat_worker():
    while True:
        payload = { **SYS_INFO, "payload_type": "HEARTBEAT" }
        await queue.put(payload)
        await asyncio.sleep(CONFIG["heartbeat"])

# --- WORKER 2: Periodically sends telemetry data to the gateway ---
async def telemetry_worker():
    psutil.cpu_percent() 
    while True:
        payload = {
            **SYS_INFO,
            "payload_type": "TELEMETRY",
            "cpu_usage_pct": psutil.cpu_percent(interval=None),
            "ram_usage_pct": psutil.virtual_memory().percent,
            "swap_usage_pct": psutil.swap_memory().percent,
            "storage_root_pct": psutil.disk_usage('/').percent,
            "top_processes": [] # Omitted for brevity
        }
        await queue.put(payload)
        await asyncio.sleep(CONFIG["telemetry"])

# --- WORKER 3: Listens for configuration updates on Telemetry intervals from the Gateway ---
async def listen_for_config(ws):
    """Listens for configuration updates pushed DOWN from the Gateway."""
    async for message in ws:
        data = json.loads(message)
        if data.get("type") == "CONFIG_SYNC":
            if CONFIG["heartbeat"] != data["heartbeat_interval"]:
                print(f"[*] Adjusted Heartbeat -> {data['heartbeat_interval']}s")
            if CONFIG["telemetry"] != data["telemetry_interval"]:
                print(f"[*] Adjusted Telemetry -> {data['telemetry_interval']}s")
                
            CONFIG["heartbeat"] = data["heartbeat_interval"]
            CONFIG["telemetry"] = data["telemetry_interval"]

async def comms_worker():
    """Handles the main communication loop with the Gateway."""
    while True:
        try:
            async with websockets.connect(GATEWAY_URL) as ws:
                print("[+] Tunnel established. Awaiting payloads...")
                
                # Start listening for reverse traffic concurrently
                asyncio.create_task(listen_for_config(ws))
                
                while True:
                    payload = await queue.get()
                    await ws.send(json.dumps(payload))
                    print(f"[>] Pushed {payload['payload_type']} via {payload['ipv4_address']}")
                    queue.task_done()
        except Exception as e:
            print(f"[-] Connection dropped. Retrying...")
            await asyncio.sleep(5)

async def main():
    initialize_identity()
    await asyncio.gather(heartbeat_worker(), telemetry_worker(), comms_worker())

if __name__ == "__main__":
    asyncio.run(main())