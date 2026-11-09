-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Lead_status_firstContactAt_escalationLevel_idx" ON "Lead"("status", "firstContactAt", "escalationLevel");

