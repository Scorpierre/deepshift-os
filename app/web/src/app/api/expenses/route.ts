import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ExpenseCategory, ExpenseType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") as ExpenseType | null;
  const category = searchParams.get("category") as ExpenseCategory | null;
  const active = searchParams.get("active");

  const expenses = await prisma.expense.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
      ...(active !== null ? { isActive: active === "true" } : {}),
    },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { label, vendor, amount, date, category, type, billingCycle, renewsAt, notes } = body;

  if (!label || amount === undefined || !category || !type) {
    return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      label,
      vendor: vendor ?? null,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      category,
      type,
      billingCycle: billingCycle ?? null,
      renewsAt: renewsAt ? new Date(renewsAt) : null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
