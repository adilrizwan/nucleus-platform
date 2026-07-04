#!/bin/bash

# Explicitly set the directory based on your path
DIR="$HOME/Documents/Projects/nucleus-platform"
cd "$DIR" || { echo "[-] Directory not found: $DIR"; exit 1; }

echo "=========================================="
echo "   Shutting Down Nucleus Platform...      "
echo "=========================================="

# 1. Kill React UI
echo "[1/4] Stopping React Dashboard..."
if [ -f "$DIR/.ui.pid" ]; then
    kill $(cat "$DIR/.ui.pid") 2>/dev/null
    rm "$DIR/.ui.pid"
else
    # Fallback if PID file is missing
    pkill -f "npm run dev" 2>/dev/null
fi

# 2. Kill Gateway
echo "[2/4] Stopping Telemetry Gateway..."
if [ -f "$DIR/.gateway.pid" ]; then
    kill $(cat "$DIR/.gateway.pid") 2>/dev/null
    rm "$DIR/.gateway.pid"
else
    pkill -f "nucleus-gateway/server.js" 2>/dev/null
fi

# 3. Kill API
echo "[3/4] Stopping REST API..."
if [ -f "$DIR/.api.pid" ]; then
    kill $(cat "$DIR/.api.pid") 2>/dev/null
    rm "$DIR/.api.pid"
else
    pkill -f "nucleus-api/server.js" 2>/dev/null
fi

# 4. Stop Database
echo "[4/4] Stopping PostgreSQL Container..."
docker compose down

echo "=========================================="
echo "[-] All services successfully shut down."
echo "=========================================="
