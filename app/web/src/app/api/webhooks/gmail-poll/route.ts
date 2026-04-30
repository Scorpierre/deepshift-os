import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { listUnreadEmailIds, getEmailMessage, extractEmailAddress } from "@/lib/gmail";

type Intent =
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "NEEDS_INFO"
  | "PROPOSAL_REQUESTED"
  | "LATER"
  | "UNCLEAR";

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
  prospectName: string
): Promise<{ intent: Intent; analysis: string; laterDate?: string }> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
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
 * Lit les emails non lus, les associe aux prospects par adresse email,
 * analyse l'intent et met à jour les statuts.
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

    // Cherche le prospect correspondant à l'adresse expéditrice
    const prospect = await prisma.prospect.findFirst({
      where: { email: { equals: senderEmail, mode: "insensitive" } },
    });

    if (!prospect) {
      skipped++;
      continue;
    }

    const { intent, analysis, laterDate } = await analyzeEmail(message.body, prospect.name);

    // Détermine le nouveau statut
    const statusMap: Partial<Record<Intent, string>> = {
      INTERESTED: "QUALIFIED",
      NOT_INTERESTED: "LOST",
      NEEDS_INFO: "QUALIFIED",
      PROPOSAL_REQUESTED: "PROPOSAL_SENT",
    };

    let newStatus: string | undefined = statusMap[intent];

    // UNCLEAR → ARCHIVED seulement si le prospect n'est pas encore avancé
    if (intent === "UNCLEAR" && ["NEW", "CONTACTED"].includes(prospect.status)) {
      newStatus = "ARCHIVED";
    }

    // Ne jamais rétrograder un statut déjà avancé
    if (newStatus && !canTransition(prospect.status, newStatus)) {
      newStatus = undefined;
    }

    // Mise à jour du prospect
    const prospectUpdate: Record<string, unknown> = {
      lastContactedAt: new Date(),
      ...(newStatus && { status: newStatus }),
    };

    // LATER : remplit nextActionAt et crée un reminder
    if (intent === "LATER" && laterDate) {
      prospectUpdate.nextActionAt = new Date(laterDate);
      prospectUpdate.nextActionNote = `Relance suite réponse : ${analysis}`;
    }

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

    // Sauvegarde l'email en base pour ne pas le retraiter
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
