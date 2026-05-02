-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('INFRA', 'TOOLS', 'MARKETING', 'FORMATION', 'EQUIPMENT', 'OTHER');

CREATE TYPE "ExpenseType" AS ENUM ('ONE_TIME', 'SUBSCRIPTION');

CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "vendor" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "ExpenseCategory" NOT NULL,
    "type" "ExpenseType" NOT NULL DEFAULT 'ONE_TIME',
    "billingCycle" "BillingCycle",
    "renewsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_type_idx" ON "Expense"("type");
CREATE INDEX "Expense_category_idx" ON "Expense"("category");
CREATE INDEX "Expense_isActive_idx" ON "Expense"("isActive");
