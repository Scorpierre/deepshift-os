import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber } from "@/lib/sequencing";

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

  const NON_PROGRESSABLE = ["WON", "LOST", "ARCHIVED"];

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
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
    });

    await tx.quote.update({ where: { id }, data: { status: "ACCEPTED" } });

    const prospect = await tx.prospect.findUnique({
      where: { id: quote.prospectId },
      select: { status: true },
    });
    if (prospect && !NON_PROGRESSABLE.includes(prospect.status)) {
      await tx.prospect.update({ where: { id: quote.prospectId }, data: { status: "WON" } });
    }

    return inv;
  });

  return NextResponse.json(invoice, { status: 201 });
}
