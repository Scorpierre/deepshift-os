import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@prisma/client";

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { number: { startsWith: `FAC-${year}-` } },
  });
  return `FAC-${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const prospectId = searchParams.get("prospectId");
  const status = searchParams.get("status") as InvoiceStatus | null;

  // Marquer les factures en retard
  await prisma.invoice.updateMany({
    where: { status: "PENDING", dueAt: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(prospectId ? { prospectId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      prospect: { select: { id: true, name: true, company: true, email: true } },
      quote: { select: { number: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { prospectId, title, lines, totalHT, dueAt, notes } = body;

  if (!prospectId || !title || !lines || totalHT === undefined || !dueAt) {
    return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
  }

  const number = await generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      prospectId,
      number,
      title,
      lines,
      totalHT,
      dueAt: new Date(dueAt),
      notes: notes ?? null,
    },
    include: {
      prospect: { select: { id: true, name: true, company: true, email: true } },
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
