import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      prospect: { select: { id: true, name: true, company: true, email: true } },
      invoice: true,
    },
  });
  if (!quote) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json(quote);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const quote = await prisma.quote.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.lines !== undefined ? { lines: body.lines } : {}),
      ...(body.totalHT !== undefined ? { totalHT: body.totalHT } : {}),
      ...(body.validUntil !== undefined ? { validUntil: body.validUntil ? new Date(body.validUntil) : null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
    include: {
      prospect: { select: { id: true, name: true, company: true, email: true } },
    },
  });

  return NextResponse.json(quote);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
