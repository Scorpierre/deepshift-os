import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      prospect: { select: { id: true, name: true, company: true, email: true } },
      quote: { select: { number: true, title: true } },
      paymentReminders: { orderBy: { sentAt: "asc" } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.lines !== undefined ? { lines: body.lines } : {}),
      ...(body.totalHT !== undefined ? { totalHT: body.totalHT } : {}),
      ...(body.dueAt !== undefined ? { dueAt: new Date(body.dueAt) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
    include: {
      prospect: { select: { id: true, name: true, company: true, email: true } },
    },
  });

  return NextResponse.json(invoice);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
