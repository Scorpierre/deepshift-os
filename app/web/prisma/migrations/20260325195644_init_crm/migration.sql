-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('SENT', 'RECEIVED');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'DONE', 'SNOOZED');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('FOLLOW_UP', 'CALL', 'PROPOSAL', 'CUSTOM');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "score" INTEGER,
    "needType" TEXT[],
    "estimatedBudget" DOUBLE PRECISION,
    "source" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "nextActionAt" TIMESTAMP(3),
    "nextActionNote" TEXT,
    "aiSummary" TEXT,
    "aiScoreReason" TEXT,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prospectId" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "gmailId" TEXT,
    "aiAnalysis" TEXT,
    "aiIntent" TEXT,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prospectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prospectId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "type" "ReminderType" NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_email_key" ON "Prospect"("email");

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
