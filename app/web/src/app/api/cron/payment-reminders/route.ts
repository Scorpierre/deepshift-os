import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Appelé par n8n chaque matin.
 * Envoie des relances email pour les factures en retard de paiement.
 * - J+30 après échéance → relance douce
 * - J+45 après échéance → relance ferme
 * Évite les doublons via PaymentReminder.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Marquer OVERDUE les factures dépassées
  await prisma.invoice.updateMany({
    where: { status: "PENDING", dueAt: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });

  const overdue = await prisma.invoice.findMany({
    where: { status: "OVERDUE" },
    include: {
      prospect: { select: { name: true, email: true } },
      paymentReminders: { select: { type: true } },
    },
  });

  const now = Date.now();
  let sent = 0;

  for (const invoice of overdue) {
    const daysPastDue = Math.floor((now - new Date(invoice.dueAt).getTime()) / DAY);
    const hasJ30 = invoice.paymentReminders.some((r) => r.type === "DAY_30");
    const hasJ45 = invoice.paymentReminders.some((r) => r.type === "DAY_45");

    if (daysPastDue >= 45 && !hasJ45) {
      await sendEmail({
        to: invoice.prospect.email,
        subject: `⚠️ Relance paiement — Facture ${invoice.number}`,
        body: `Bonjour ${invoice.prospect.name},

Je me permets de vous contacter à nouveau concernant la facture ${invoice.number} d'un montant de ${invoice.totalHT.toLocaleString("fr-FR")} € HT, dont l'échéance est dépassée depuis ${daysPastDue} jours.

Sans retour de votre part dans les prochains jours, je serai contraint de passer ce dossier à un service de recouvrement.

Merci de bien vouloir régulariser cette situation dans les meilleurs délais.

Cordialement,
Pierre Connes — DeepShift`,
      });
      await prisma.paymentReminder.create({
        data: { invoiceId: invoice.id, sentAt: new Date(), type: "DAY_45" },
      });
      sent++;
    } else if (daysPastDue >= 30 && !hasJ30) {
      await sendEmail({
        to: invoice.prospect.email,
        subject: `Relance — Facture ${invoice.number} en attente de règlement`,
        body: `Bonjour ${invoice.prospect.name},

Sauf erreur de ma part, la facture ${invoice.number} d'un montant de ${invoice.totalHT.toLocaleString("fr-FR")} € HT n'a pas encore été réglée. Son échéance était le ${new Date(invoice.dueAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.

Pourriez-vous me confirmer la bonne réception de cette facture et me donner une date prévisionnelle de règlement ?

Merci d'avance,
Pierre Connes — DeepShift`,
      });
      await prisma.paymentReminder.create({
        data: { invoiceId: invoice.id, sentAt: new Date(), type: "DAY_30" },
      });
      sent++;
    }
  }

  return NextResponse.json({ checked: overdue.length, sent });
}
