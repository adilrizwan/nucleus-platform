-- CreateTable
CREATE TABLE "managed_servers" (
    "server_id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "alias" TEXT,
    "group_name" TEXT,
    "ip_address" TEXT NOT NULL,
    "os_release" TEXT NOT NULL,
    "polling_interval" INTEGER NOT NULL DEFAULT 5,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',

    CONSTRAINT "managed_servers_pkey" PRIMARY KEY ("server_id")
);

-- CreateTable
CREATE TABLE "latest_telemetry" (
    "id" SERIAL NOT NULL,
    "server_id" TEXT NOT NULL,
    "cpu_usage_pct" DOUBLE PRECISION NOT NULL,
    "ram_usage_pct" DOUBLE PRECISION NOT NULL,
    "swap_usage_pct" DOUBLE PRECISION NOT NULL,
    "storage_root_pct" DOUBLE PRECISION NOT NULL,
    "top_processes" JSONB NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "latest_telemetry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "latest_telemetry" ADD CONSTRAINT "latest_telemetry_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "managed_servers"("server_id") ON DELETE CASCADE ON UPDATE CASCADE;
