-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'MAINTENANCE';

-- AlterTable
ALTER TABLE "Email" ADD COLUMN IF NOT EXISTS "aiMeetingDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "aiMeetingNote" TEXT,
ADD COLUMN IF NOT EXISTS "meetingEventId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Email_prospectId_idx" ON "Email"("prospectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Email_prospectId_direction_idx" ON "Email"("prospectId", "direction");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Email_sentAt_idx" ON "Email"("sentAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Prospect_status_idx" ON "Prospect"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Prospect_updatedAt_idx" ON "Prospect"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reminder_prospectId_idx" ON "Reminder"("prospectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reminder_status_dueAt_idx" ON "Reminder"("status", "dueAt");

