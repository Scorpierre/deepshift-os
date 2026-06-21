import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { listUnreadEmailIds, getEmailMessage, extractEmailAddress } from "@/lib/gmail";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_HAIKU } from "@/config";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";

type Intent =
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "NEEDS_INFO"
  | "PROPOSAL_REQUESTED"
  | "LATER"
  | "UNCLEAR";

const INTENT_CONFIG: Record<Intent, { status?: string; tag: string; action?: string }> = {
  INTERESTED:         { status: "QUALIFIED",     tag: "intéressé",      action: "Relancer rapidement — intérêt confirmé" },
  NEEDS_INFO:         { status: "QUALIFIED",     tag: "besoin d'infos", action: "Répondre à ses questions" },
  UNCLEAR:            { status: "QUALIFIED",     tag: "à clarifier",    action: "Appeler pour clarifier la réponse" },
  PROPOSAL_REQUESTED: { status: "PROPOSAL_SENT", tag: "devis demandé",  action: "Envoyer le devis" },
  LATER:              { status: "ARCHIVED",      tag: "plus tard" },
  NOT_INTERESTED:     { status: "ARCHIVED",      tag: "pas intéressé" },
};

const STATUS_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"];

function canTransition(current: string, target: string): boolean {
  const currentIdx = STATUS_ORDER.indexOf(current);
  const targetIdx = STATUS_ORDER.indexOf(target);
  if (currentIdx === -1 || targetIdx === -1) return true;
  return targetIdx > currentIdx;
}

type MeetingAction = "CONFIRMED" | "RESCHEDULED" | "CANCELLED" | null;

async function analyzeEmail(
  emailBody: string,
  prospectName: string,
  existingMeetingDate?: string | null
): Promise<{ intent: Intent; analysis: string; laterDate?: string; meetingDatetime?: string; meetingNote?: string; meetingAction?: MeetingAction; newMeetingDatetime?: string }> {
  const meetingContext = existingMeetingDate
    ? `\nRDV existant planifié : ${new Date(existingMeetingDate).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}. Détermine si cet email parle de ce RDV (meetingAction) :\n- CONFIRMED : le prospect confirme le RDV\n- RESCHEDULED : le prospect veut reporter (extrais newMeetingDatetime)\n- CANCELLED : le prospect annule\n- null : pas lié au RDV existant`
    : "";

  const message = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `Tu analyses la réponse d'un prospect à un email de prospection commercial (DeepShift — web apps sur mesure).

Prospect : ${prospectName}
${meetingContext}

Email reçu :
---
${emailBody.slice(0, 2000)}
---

Détermine l'intent de ce prospect parmi :
- INTERESTED : intéressé, veut en savoir plus, propose un rendez-vous
- NOT_INTERESTED : refuse clairement, pas intéressé
- NEEDS_INFO : pose des questions sur l'offre, demande des précisions
- PROPOSAL_REQUESTED : demande un devis ou une proposition concrète
- LATER : pas maintenant mais ouvre la porte plus tard ("rappelez-moi dans X", "recontactez-moi en Y")
- UNCLEAR : réponse vague, hors sujet, ou impossible à interpréter

Si intent = LATER, extrais la date mentionnée (format ISO YYYY-MM-DD). Si pas de date précise, ajoute 3 mois à aujourd'hui (${new Date().toISOString().slice(0, 10)}).

Si le prospect propose ou confirme un nouveau RDV avec date et heure précises, extrais :
- meetingDatetime : format ISO "YYYY-MM-DDTHH:mm:00" (heure Paris)
- meetingNote : description courte (ex: "Appel de découverte", "RDV visio")

Réponds UNIQUEMENT en JSON :
{
  "intent": "INTERESTED|NOT_INTERESTED|NEEDS_INFO|PROPOSAL_REQUESTED|LATER|UNCLEAR",
  "analysis": "1 phrase résumant la réponse du prospect",
  "laterDate": "YYYY-MM-DD ou null",
  "meetingDatetime": "YYYY-MM-DDTHH:mm:00 ou null",
  "meetingNote": "description courte ou null",
  "meetingAction": "CONFIRMED|RESCHEDULED|CANCELLED|null",
  "newMeetingDatetime": "YYYY-MM-DDTHH:mm:00 ou null (si RESCHEDULED)"
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{
    intent?: Intent; analysis?: string; laterDate?: string;
    meetingDatetime?: string; meetingNote?: string;
    meetingAction?: MeetingAction; newMeetingDatetime?: string;
  }>(raw, "gmail-poll");
  return {
    intent: parsed?.intent ?? "UNCLEAR",
    analysis: parsed?.analysis ?? "",
    laterDate: parsed?.laterDate ?? undefined,
    meetingDatetime: parsed?.meetingDatetime ?? undefined,
    meetingNote: parsed?.meetingNote ?? undefined,
    meetingAction: parsed?.meetingAction ?? null,
    newMeetingDatetime: parsed?.newMeetingDatetime ?? undefined,
  };
}

/**
 * Appelé par n8n toutes les heures.
 * Scan inbox 2 derniers jours, associe aux prospects, analyse l'intent et met à jour les statuts.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-n8n-secret");
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gmailIds = await listUnreadEmailIds();
  if (gmailIds.length === 0) return NextResponse.json({ processed: 0, skipped: 0 });

  const existing = await prisma.email.findMany({
    where: { gmailId: { in: gmailIds } },
    select: { gmailId: true },
  });
  const existingIds = new Set(existing.map((e) => e.gmailId));
  const toProcess = gmailIds.filter((id) => !existingIds.has(id));

  let processed = 0;
  let skipped = 0;

  // Batch Gmail API calls (was N sequential HTTP requests)
  const messages = await Promise.all(toProcess.map(getEmailMessage));

  // Batch prospect lookup (was N separate DB queries)
  const senderEmails = messages.map((m) => extractEmailAddress(m.from));
  const matchingProspects = await prisma.prospect.findMany({
    where: {
      OR: senderEmails.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })),
    },
  });
  const prospectByEmail = new Map(matchingProspects.map((p) => [p.email.toLowerCase(), p]));

  for (let i = 0; i < toProcess.length; i++) {
    const gmailId = toProcess[i];
    const message = messages[i];
    const senderEmail = extractEmailAddress(message.from);

    const prospect = prospectByEmail.get(senderEmail.toLowerCase());

    if (!prospect) { skipped++; continue; }

    // Find most recent active meeting event for this prospect
    const existingMeetingEmail = await prisma.email.findFirst({
      where: { prospectId: prospect.id, meetingEventId: { not: null } },
      orderBy: { sentAt: "desc" },
      select: { id: true, meetingEventId: true, aiMeetingDate: true },
    });

    const { intent, analysis, laterDate, meetingDatetime, meetingNote, meetingAction, newMeetingDatetime } =
      await analyzeEmail(message.body, prospect.name, existingMeetingEmail?.aiMeetingDate?.toISOString());

    const config = INTENT_CONFIG[intent];

    const newStatus = config.status && canTransition(prospect.status, config.status)
      ? config.status
      : undefined;

    const existingTags: string[] = Array.isArray(prospect.aiTags) ? prospect.aiTags as string[] : [];
    const updatedTags = Array.from(new Set([...existingTags, config.tag]));

    const prospectUpdate: Record<string, unknown> = {
      lastContactedAt: new Date(),
      aiTags: updatedTags,
      ...(newStatus && { status: newStatus }),
      ...(config.action && { aiRecommendedAction: config.action }),
      ...(intent === "LATER" && laterDate && {
        nextActionAt: new Date(laterDate),
        nextActionNote: `Relance suite réponse : ${analysis}`,
      }),
    };

    await prisma.prospect.update({ where: { id: prospect.id }, data: prospectUpdate });

    if (intent === "LATER" && laterDate) {
      await prisma.reminder.create({
        data: {
          prospectId: prospect.id,
          dueAt: new Date(laterDate),
          note: `Relance demandée par le prospect : ${analysis}`,
          type: "FOLLOW_UP",
        },
      });
    }

    await prisma.email.create({
      data: {
        prospectId: prospect.id,
        direction: "RECEIVED",
        subject: message.subject,
        body: message.body,
        sentAt: new Date(),
        gmailId,
        aiAnalysis: analysis,
        aiIntent: intent,
        aiMeetingDate: meetingDatetime ? new Date(meetingDatetime) : null,
        aiMeetingNote: meetingNote ?? null,
      },
    });

    // Apply meeting lifecycle actions on Google Calendar
    if (meetingAction && existingMeetingEmail?.meetingEventId) {
      const eventId = existingMeetingEmail.meetingEventId;
      try {
        if (meetingAction === "CONFIRMED") {
          await updateCalendarEvent(eventId, {
            description: `RDV confirmé par le prospect — ${analysis}`,
          });
        } else if (meetingAction === "RESCHEDULED" && newMeetingDatetime) {
          const newStart = new Date(newMeetingDatetime);
          const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
          await updateCalendarEvent(eventId, {
            description: `Reporté par le prospect — ${analysis}`,
            start: { dateTime: newStart.toISOString(), timeZone: "Europe/Paris" },
            end: { dateTime: newEnd.toISOString(), timeZone: "Europe/Paris" },
          });
          // Sync the stored date so future emails use the new datetime
          await prisma.email.update({
            where: { id: existingMeetingEmail.id },
            data: { aiMeetingDate: newStart },
          });
        } else if (meetingAction === "CANCELLED") {
          await deleteCalendarEvent(eventId);
          await prisma.email.update({
            where: { id: existingMeetingEmail.id },
            data: { meetingEventId: null },
          });
        }
      } catch (e) {
        console.error("Calendar lifecycle error:", e);
      }
    }

    processed++;
  }

  return NextResponse.json({ processed, skipped });
}
