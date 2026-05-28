import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called by n8n on the 1st of each month — creates an Expense for last month's Claude API usage
export async function POST(req: NextRequest) {
  if (req.headers.get("x-n8n-secret") !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const agg = await prisma.aiUsageLog.aggregate({
    where: { createdAt: { gte: startOfLastMonth, lt: endOfLastMonth } },
    _sum: { costUsd: true },
    _count: { id: true },
  });

  const costUsd = agg._sum.costUsd ?? 0;
  if (costUsd === 0) {
    return NextResponse.json({ skipped: true, reason: "no usage last month" });
  }

  // Convert USD → EUR at ~0.92 (fixed approximation)
  const EUR_RATE = 0.92;
  const amountEur = Math.round(costUsd * EUR_RATE * 100) / 100;

  const monthLabel = startOfLastMonth.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const expense = await prisma.expense.create({
    data: {
      label: `Claude API — ${monthLabel}`,
      vendor: "Anthropic",
      amount: amountEur,
      date: endOfLastMonth,
      category: "TOOLS",
      type: "ONE_TIME",
      notes: `${agg._count.id} appels · $${costUsd.toFixed(4)} USD converti à 0.92`,
    },
  });

  return NextResponse.json({ created: true, expense });
}
