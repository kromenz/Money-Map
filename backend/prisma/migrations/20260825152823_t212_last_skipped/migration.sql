-- AlterTable
ALTER TABLE "public"."SyncState" ADD COLUMN     "lastSkipped" INTEGER NOT NULL DEFAULT 0;
