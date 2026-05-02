import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [activeSubs, oneTimeThisMonth] = await Promise.all([
    prisma.expense.findMany({
      where: { type: "SUBSCRIPTION", isActive: true },
      select: { amount: true, billingCycle: true, category: true },
    }),
    prisma.expense.findMany({
      where: { type: "ONE_TIME", date: { gte: startOfMonth } },
      select: { amount: true, category: true },
    }),
  ]);

  const monthlyRecurring = activeSubs.reduce((sum, s) => {
    return sum + (s.billingCycle === "ANNUAL" ? s.amount / 12 : s.amount);
  }, 0);

  const annualBurden = activeSubs.reduce((sum, s) => {
    return sum + (s.billingCycle === "MONTHLY" ? s.amount * 12 : s.amount);
  }, 0);

  const expensesThisMonth = oneTimeThisMonth.reduce((sum, e) => sum + e.amount, 0);

  const byCategoryMap: Record<string, number> = {};
  for (const s of activeSubs) {
    const monthly = s.billingCycle === "ANNUAL" ? s.amount / 12 : s.amount;
    byCategoryMap[s.category] = (byCategoryMap[s.category] ?? 0) + monthly;
  }
  for (const e of oneTimeThisMonth) {
    byCategoryMap[e.category] = (byCategoryMap[e.category] ?? 0) + e.amount;
  }
  const byCategory = Object.entries(byCategoryMap).map(([category, amount]) => ({ category, amount }));

  return NextResponse.json({
    monthlyRecurring,
    annualBurden,
    expensesThisMonth,
    activeSubscriptions: activeSubs.length,
    byCategory,
  });
}
