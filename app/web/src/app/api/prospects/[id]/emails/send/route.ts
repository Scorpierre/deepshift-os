import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, applyLabel } from "@/lib/gmail";
import { anthropic } from "@/lib/anthropic";
import { parseAiJson } from "@/lib/parse-ai-json";

export const maxDuration = 30;
import { createCalendarEvent } from "@/lib/google-calendar";
import { MODEL_HAIKU } from "@/config";

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

  // Détecte si l'email sortant contient une date/heure de RDV proposée
  try {
    const aiMsg = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Cet email de prospection contient-il une proposition de rendez-vous avec une date et une heure précises ?
Email :
---
${body.slice(0, 1500)}
---
Réponds UNIQUEMENT en JSON :
{"meetingDatetime":"YYYY-MM-DDTHH:mm:00 ou null","meetingNote":"description courte ou null"}`,
      }],
    });
    const raw = aiMsg.content[0].type === "text" ? aiMsg.content[0].text : "";
    const parsed = parseAiJson<{ meetingDatetime?: string; meetingNote?: string }>(raw, "send-date-detect");
    if (parsed?.meetingDatetime) {
      const start = new Date(parsed.meetingDatetime);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const calEvent = await createCalendarEvent({
        summary: parsed.meetingNote ?? `RDV ${prospect.name}`,
        description: `Proposé par email — ${subject}`,
        start: { dateTime: start.toISOString(), timeZone: "Europe/Paris" },
        end: { dateTime: end.toISOString(), timeZone: "Europe/Paris" },
        attendees: [{ email: prospect.email }],
      });
      await prisma.email.update({
        where: { id: email.id },
        data: { meetingEventId: calEvent.id, aiMeetingDate: start, aiMeetingNote: parsed.meetingNote ?? null },
      });
    }
  } catch (e) {
    console.error("Outgoing meeting detection error:", e);
  }

  return NextResponse.json(email, { status: 201 });
}
