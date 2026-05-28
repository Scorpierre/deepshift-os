import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [currentMonth, lastMonth, allTime, byModel] = await Promise.all([
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { id: true },
    }),
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: startOfLastMonth, lt: endOfLastMonth } },
      _sum: { costUsd: true },
      _count: { id: true },
    }),
    prisma.aiUsageLog.aggregate({
      _sum: { costUsd: true },
      _count: { id: true },
    }),
    prisma.aiUsageLog.groupBy({
      by: ["model"],
      where: { createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: "desc" } },
    }),
  ]);

  // Daily costs for last 30 days
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const logs = await prisma.aiUsageLog.findMany({
    where: { createdAt: { gte: since30 } },
    select: { createdAt: true, costUsd: true },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap: Record<string, number> = {};
  for (const log of logs) {
    const day = log.createdAt.toISOString().split("T")[0];
    dailyMap[day] = (dailyMap[day] ?? 0) + log.costUsd;
  }
  const last30Days = Object.entries(dailyMap).map(([date, costUsd]) => ({ date, costUsd }));

  return NextResponse.json({
    currentMonth: {
      costUsd: currentMonth._sum.costUsd ?? 0,
      inputTokens: currentMonth._sum.inputTokens ?? 0,
      outputTokens: currentMonth._sum.outputTokens ?? 0,
      callCount: currentMonth._count.id,
    },
    lastMonth: {
      costUsd: lastMonth._sum.costUsd ?? 0,
      callCount: lastMonth._count.id,
    },
    allTime: {
      costUsd: allTime._sum.costUsd ?? 0,
      callCount: allTime._count.id,
    },
    byModel: byModel.map((m) => ({
      model: m.model,
      costUsd: m._sum.costUsd ?? 0,
      inputTokens: m._sum.inputTokens ?? 0,
      outputTokens: m._sum.outputTokens ?? 0,
      callCount: m._count.id,
    })),
    last30Days,
  });
}
