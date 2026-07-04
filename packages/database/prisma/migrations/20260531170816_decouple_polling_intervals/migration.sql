/*
  Warnings:

  - You are about to drop the column `polling_interval` on the `managed_servers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "managed_servers" DROP COLUMN "polling_interval",
ADD COLUMN     "heartbeat_interval" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "telemetry_interval" INTEGER NOT NULL DEFAULT 300;
