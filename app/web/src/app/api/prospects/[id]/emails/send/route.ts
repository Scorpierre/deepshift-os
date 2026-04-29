import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { subject, body } = await request.json();

  const prospect = await prisma.prospect.findUnique({ where: { id } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  // Envoi Gmail
  const { gmailId } = await sendEmail({ to: prospect.email, subject, body });

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
  const statusesToUpgrade = ["NEW", "LOST", "ARCHIVED"];
  await prisma.prospect.update({
    where: { id },
    data: {
      lastContactedAt: new Date(),
      ...(statusesToUpgrade.includes(prospect.status) && { status: "CONTACTED" }),
    },
  });

  return NextResponse.json(email, { status: 201 });
}
