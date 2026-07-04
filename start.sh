#!/bin/bash

# Explicitly set the directory based on your path
DIR="$HOME/Documents/Projects/nucleus-platform"
cd "$DIR" || { echo "[-] Directory not found: $DIR"; exit 1; }

echo "=========================================="
echo "   Booting Nucleus Platform (Dev Mode)    "
echo "=========================================="

# 1. Database
echo "[1/4] Starting PostgreSQL Database..."
docker compose up -d
sleep 5 # Give the DB a moment to initialize

# 2. API (Management Plane)
echo "[2/4] Starting REST API..."
cd "$DIR/services/nucleus-api"
nohup node server.js > api.log 2>&1 &
echo $! > "$DIR/.api.pid"

# 3. Gateway (Data Plane)
echo "[3/4] Starting Telemetry Gateway..."
cd "$DIR/services/nucleus-gateway"
nohup node server.js > gateway.log 2>&1 &
echo $! > "$DIR/.gateway.pid"

# 4. React Dashboard
echo "[4/4] Starting React UI..."
cd "$DIR/frontend/nucleus-ui"
nohup npm run dev > ui.log 2>&1 &
echo $! > "$DIR/.ui.pid"

echo "=========================================="
echo "[+] All services are running in the background!"
echo "[+] Dashboard URL: http://localhost:5173"
echo ""
echo "Note: To see live logs for any service, use the 'tail' command."
echo "      Example: tail -f $DIR/services/nucleus-gateway/gateway.log"
echo "=========================================="
