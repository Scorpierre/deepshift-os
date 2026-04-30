import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { number: { startsWith: `FAC-${year}-` } },
  });
  return `FAC-${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { invoice: { select: { id: true } } },
  });
  if (!quote) return NextResponse.json({ error: "Devis introuvable." }, { status: 404 });
  if (quote.invoice) return NextResponse.json({ error: "Une facture existe déjà pour ce devis." }, { status: 409 });

  const number = await generateInvoiceNumber();
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines = quote.lines as any;

  const [invoice] = await prisma.$transaction([
    prisma.invoice.create({
      data: {
        prospectId: quote.prospectId,
        quoteId: quote.id,
        number,
        title: quote.title,
        lines,
        totalHT: quote.totalHT,
        dueAt,
      },
      include: { prospect: { select: { id: true, name: true, company: true, email: true } } },
    }),
    prisma.quote.update({
      where: { id },
      data: { status: "ACCEPTED" },
    }),
    prisma.prospect.update({
      where: { id: quote.prospectId },
      data: { status: "WON" },
    }),
  ]);

  return NextResponse.json(invoice, { status: 201 });
}
