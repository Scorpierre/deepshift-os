import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { listUnreadEmailIds, getEmailMessage, getEmailAttachments, extractEmailAddress, type EmailAttachment } from "@/lib/gmail";

type TextBlock = { type: "text"; text: string };
type DocumentBlock = { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string }; title?: string };
type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };
type ContentBlock = TextBlock | DocumentBlock | ImageBlock;

type Intent =
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "NEEDS_INFO"
  | "PROPOSAL_REQUESTED"
  | "LATER"
  | "UNCLEAR";

const INTENT_CONFIG: Record<Intent, {
  status?: string;
  tag: string;
  action?: string;
}> = {
  INTERESTED:         { status: "QUALIFIED",     tag: "intéressé",     action: "Relancer rapidement — intérêt confirmé" },
  NEEDS_INFO:         { status: "QUALIFIED",     tag: "besoin d'infos", action: "Répondre à ses questions" },
  UNCLEAR:            { status: "QUALIFIED",     tag: "à clarifier",   action: "Appeler pour clarifier la réponse" },
  PROPOSAL_REQUESTED: { status: "PROPOSAL_SENT", tag: "devis demandé", action: "Envoyer le devis" },
  LATER:              { status: "ARCHIVED",      tag: "plus tard" },
  NOT_INTERESTED:     { status: "ARCHIVED",      tag: "pas intéressé" },
};

// Statuts qu'on ne doit jamais rétrograder
const STATUS_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"];

function canTransition(current: string, target: string): boolean {
  const currentIdx = STATUS_ORDER.indexOf(current);
  const targetIdx = STATUS_ORDER.indexOf(target);
  if (currentIdx === -1 || targetIdx === -1) return true;
  return targetIdx > currentIdx;
}

async function analyzeEmail(
  emailBody: string,
  prospectName: string,
  attachments: EmailAttachment[] = []
): Promise<{ intent: Intent; analysis: string; laterDate?: string }> {
  const promptText = `Tu analyses la réponse d'un prospect à un email de prospection commercial (DeepShift — web apps sur mesure).

Prospect : ${prospectName}

Email reçu :
---
${emailBody.slice(0, 2000)}
---
${attachments.length > 0 ? `\nPièces jointes (${attachments.length}) ci-dessous — elles peuvent contenir un cahier des charges, un devis, ou des specs.` : ""}

Détermine l'intent de ce prospect parmi :
- INTERESTED : intéressé, veut en savoir plus, propose un rendez-vous
- NOT_INTERESTED : refuse clairement, pas intéressé
- NEEDS_INFO : pose des questions sur l'offre, demande des précisions
- PROPOSAL_REQUESTED : demande un devis ou une proposition concrète (ou envoie un cahier des charges)
- LATER : pas maintenant mais ouvre la porte plus tard ("rappelez-moi dans X", "recontactez-moi en Y")
- UNCLEAR : réponse vague, hors sujet, ou impossible à interpréter

Si intent = LATER, extrais la date mentionnée (format ISO YYYY-MM-DD). Si pas de date précise, ajoute 3 mois à aujourd'hui (${new Date().toISOString().slice(0, 10)}).

Réponds UNIQUEMENT en JSON :
{
  "intent": "INTERESTED|NOT_INTERESTED|NEEDS_INFO|PROPOSAL_REQUESTED|LATER|UNCLEAR",
  "analysis": "1 phrase résumant la réponse du prospect",
  "laterDate": "YYYY-MM-DD ou null"
}`;

  const contentBlocks: ContentBlock[] = [{ type: "text", text: promptText }];

  for (const file of attachments) {
    if (file.mimeType === "application/pdf") {
      contentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.data },
        title: file.filename,
      });
    } else if (file.mimeType.startsWith("image/")) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: file.mimeType, data: file.data },
      });
    }
  }

  const model = attachments.length > 0 ? "claude-sonnet-4-5" : "claude-haiku-4-5-20251001";

  const message = await anthropic.messages.create({
    model,
    max_tokens: 300,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: contentBlocks as any }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(match?.[0] ?? "{}");
    return {
      intent: parsed.intent ?? "UNCLEAR",
      analysis: parsed.analysis ?? "",
      laterDate: parsed.laterDate ?? undefined,
    };
  } catch {
    return { intent: "UNCLEAR", analysis: "" };
  }
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
  if (gmailIds.length === 0) {
    return NextResponse.json({ processed: 0, skipped: 0 });
  }

  // Filtre les emails déjà traités en base
  const existing = await prisma.email.findMany({
    where: { gmailId: { in: gmailIds } },
    select: { gmailId: true },
  });
  const existingIds = new Set(existing.map((e) => e.gmailId));
  const toProcess = gmailIds.filter((id) => !existingIds.has(id));

  let processed = 0;
  let skipped = 0;

  for (const gmailId of toProcess) {
    const message = await getEmailMessage(gmailId);
    const senderEmail = extractEmailAddress(message.from);

    const prospect = await prisma.prospect.findFirst({
      where: { email: { equals: senderEmail, mode: "insensitive" } },
    });

    if (!prospect) {
      skipped++;
      continue;
    }

    let attachments: EmailAttachment[] = [];
    try {
      attachments = await getEmailAttachments(gmailId);
    } catch (err) {
      console.error(`[gmail-poll] attachments fetch error for ${gmailId}:`, err);
    }

    const { intent, analysis, laterDate } = await analyzeEmail(message.body, prospect.name, attachments);
    const config = INTENT_CONFIG[intent];

    // Ne jamais rétrograder un statut déjà avancé
    const newStatus = config.status && canTransition(prospect.status, config.status)
      ? config.status
      : undefined;

    // Ajoute le tag à la liste existante (sans doublon)
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
