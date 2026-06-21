import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, applyLabel } from "@/lib/gmail";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { subject, body, force } = await request.json();

  // Avertir (pas bloquer) si jour défavorable en prospection B2B
  const day = new Date().getDay();
  const badDay = day === 0 || day === 1 || day === 5 || day === 6;
  if (badDay && !force) {
    return NextResponse.json(
      { warning: "Envoi déconseillé ce jour — préfère mardi, mercredi ou jeudi pour maximiser les réponses." },
      { status: 422 }
    );
  }

  const prospect = await prisma.prospect.findUnique({ where: { id } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  // Envoi Gmail + label pour que les réponses soient trackées par gmail-poll
  const { gmailId } = await sendEmail({ to: prospect.email, subject, body });
  await applyLabel(gmailId, "deepshift-prospect");

  // Sauvegarde en base
  const email = await prisma.email.create({
    data: {
      prospectId: id,
      direction: "SENT",
      subject,
      body,
      sentAt: new Date(),
      gmailId,
    },
  });

  // Met à jour la date de dernier contact et passe en CONTACTED si le prospect est encore en NEW
  const statusesToUpgrade = ["NEW", "SCORING", "SCORED", "VIP"];
  await prisma.prospect.update({
    where: { id },
    data: {
      lastContactedAt: new Date(),
      ...(statusesToUpgrade.includes(prospect.status) && { status: "CONTACTED" }),
    },
  });

  return NextResponse.json(email, { status: 201 });
}
