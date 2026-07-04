-- AlterTable
ALTER TABLE "managed_servers" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "server_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performed_by" TEXT NOT NULL DEFAULT 'system',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "managed_servers"("server_id") ON DELETE CASCADE ON UPDATE CASCADE;
