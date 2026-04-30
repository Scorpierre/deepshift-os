import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.quote.count({
    where: { number: { startsWith: `DEVIS-${year}-` } },
  });
  return `DEVIS-${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const prospectId = searchParams.get("prospectId");
  const status = searchParams.get("status") as QuoteStatus | null;

  const quotes = await prisma.quote.findMany({
    where: {
      ...(prospectId ? { prospectId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      prospect: { select: { id: true, name: true, company: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(quotes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { prospectId, title, lines, totalHT, validUntil, notes } = body;

  if (!prospectId || !title || !lines || totalHT === undefined) {
    return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
  }

  const number = await generateQuoteNumber();

  const quote = await prisma.quote.create({
    data: {
      prospectId,
      number,
      title,
      lines,
      totalHT,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes: notes ?? null,
    },
    include: {
      prospect: { select: { id: true, name: true, company: true, email: true } },
    },
  });

  return NextResponse.json(quote, { status: 201 });
}
