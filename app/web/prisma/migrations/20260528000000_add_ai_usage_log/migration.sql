-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");
