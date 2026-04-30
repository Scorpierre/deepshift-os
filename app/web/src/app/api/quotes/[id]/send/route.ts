import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { prospect: true },
  });

  if (!quote) return NextResponse.json({ error: "Devis introuvable." }, { status: 404 });

  const lines = quote.lines as Array<{ description: string; qty: number; unitPrice: number; total: number }>;
  const linesText = lines
    .map((l) => `  - ${l.description} (x${l.qty}) : ${l.unitPrice.toLocaleString("fr-FR")} € HT → ${l.total.toLocaleString("fr-FR")} € HT`)
    .join("\n");

  const validUntilText = quote.validUntil
    ? `Ce devis est valable jusqu'au ${new Date(quote.validUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`
    : "";

  const body = `Bonjour ${quote.prospect.name.split(" ")[0]},

Veuillez trouver ci-dessous le devis ${quote.number} pour : ${quote.title}.

Détail des prestations :
${linesText}

Total HT : ${quote.totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
(Auto-entrepreneur non assujetti à la TVA — article 293 B du CGI)

${validUntilText}

N'hésitez pas à me revenir si vous avez la moindre question.

Cordialement,
Pierre Connes — DeepShift`;

  await sendEmail({
    to: quote.prospect.email,
    subject: `Devis ${quote.number} — ${quote.title}`,
    body,
  });

  const updated = await prisma.quote.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
    include: { prospect: { select: { id: true, name: true, company: true, email: true } } },
  });

  // Mise à jour statut prospect si pas encore PROPOSAL_SENT
  if (!["PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(quote.prospect.status)) {
    await prisma.prospect.update({
      where: { id: quote.prospectId },
      data: { status: "PROPOSAL_SENT" },
    });
  }

  return NextResponse.json(updated);
}
