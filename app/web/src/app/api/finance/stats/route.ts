import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [caMonth, caYear, caTotal, pendingQuotes, pendingInvoices, overdueInvoices] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: { status: "PAID", paidAt: { gte: startOfMonth } },
        _sum: { totalHT: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "PAID", paidAt: { gte: startOfYear } },
        _sum: { totalHT: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "PAID" },
        _sum: { totalHT: true },
      }),
      prisma.quote.count({ where: { status: { in: ["DRAFT", "SENT"] } } }),
      prisma.invoice.aggregate({
        where: { status: { in: ["PENDING", "OVERDUE"] } },
        _sum: { totalHT: true },
        _count: true,
      }),
      prisma.invoice.count({ where: { status: "OVERDUE" } }),
    ]);

  return NextResponse.json({
    caMonth: caMonth._sum.totalHT ?? 0,
    caYear: caYear._sum.totalHT ?? 0,
    caTotal: caTotal._sum.totalHT ?? 0,
    pendingQuotes,
    pendingInvoicesAmount: pendingInvoices._sum.totalHT ?? 0,
    pendingInvoicesCount: pendingInvoices._count,
    overdueInvoices,
  });
}
