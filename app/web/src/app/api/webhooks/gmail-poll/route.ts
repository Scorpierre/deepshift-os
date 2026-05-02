import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { listUnreadEmailIds, getEmailMessage, extractEmailAddress } from "@/lib/gmail";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_HAIKU } from "@/config";

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

async function analyzeEmail(
  emailBody: string,
  prospectName: string
): Promise<{ intent: Intent; analysis: string; laterDate?: string }> {
  const message = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Tu analyses la réponse d'un prospect à un email de prospection commercial (DeepShift — web apps sur mesure).

Prospect : ${prospectName}

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

Réponds UNIQUEMENT en JSON :
{
  "intent": "INTERESTED|NOT_INTERESTED|NEEDS_INFO|PROPOSAL_REQUESTED|LATER|UNCLEAR",
  "analysis": "1 phrase résumant la réponse du prospect",
  "laterDate": "YYYY-MM-DD ou null"
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ intent?: Intent; analysis?: string; laterDate?: string }>(raw, "gmail-poll");
  return {
    intent: parsed?.intent ?? "UNCLEAR",
    analysis: parsed?.analysis ?? "",
    laterDate: parsed?.laterDate ?? undefined,
  };
}

/**
 * Appelé par n8n toutes les 24h.
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

    const { intent, analysis, laterDate } = await analyzeEmail(message.body, prospect.name);
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
      },
    });

    processed++;
  }

  return NextResponse.json({ processed, skipped });
}
