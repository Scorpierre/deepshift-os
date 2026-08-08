import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { sendEmail, applyLabel } from "@/lib/gmail";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_HAIKU, FOLLOWUP_J3_MS, FOLLOWUP_J7_MS, FOLLOWUP_J10_MS } from "@/config";


/**
 * Appelé par n8n chaque mardi/mercredi/jeudi à 9h.
 * - Relance J+3 et J+7 : génère et envoie les emails de relance
 * - Auto-lost J+10 : passe en LOST les prospects sans réponse après 3 emails
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();

  const prospects = await prisma.prospect.findMany({
    where: { status: { notIn: ["WON", "LOST", "ARCHIVED"] } },
    include: { emails: { orderBy: { sentAt: "asc" } } },
  });

  const results = { followup1: 0, followup2: 0, autoLost: 0 };

  for (const prospect of prospects) {
    const sentEmails = prospect.emails.filter(e => e.direction === "SENT");
    const hasResponse = prospect.emails.some(e => e.direction === "RECEIVED");

    if (hasResponse || sentEmails.length === 0) continue;

    const lastSent = sentEmails[sentEmails.length - 1];
    const timeSinceLast = now - new Date(lastSent.sentAt).getTime();

    // Auto-lost J+10 après 3 emails sans réponse
    if (sentEmails.length >= 3 && timeSinceLast >= FOLLOWUP_J10_MS) {
      await prisma.prospect.update({ where: { id: prospect.id }, data: { status: "LOST" } });
      results.autoLost++;
      continue;
    }

    const followupNumber =
      sentEmails.length === 1 && timeSinceLast >= FOLLOWUP_J3_MS ? 1
      : sentEmails.length === 2 && timeSinceLast >= FOLLOWUP_J7_MS ? 2
      : null;

    if (!followupNumber) continue;

    const firstEmail = sentEmails[0];
    const structure = followupNumber === 1
      ? `---\nSTRUCTURE OBLIGATOIRE pour la relance J+3 (3 blocs) :\n\n1. SALUTATION\n   "Bonjour [Prénom],"\n\n2. RELANCE (2 phrases max)\n   • Phrase 1 : observation ou angle nouveau — pas une répétition, une perspective différente sur leur situation\n   • Phrase 2 (optionnelle) : reformulation courte de la valeur, sous un angle différent\n\n3. CTA (1 question fermée)\n   Varie légèrement (ex: "Avez-vous eu l'occasion d'y réfléchir ?" ou "Est-ce que le timing est bon ?")\n\n4. SIGNATURE\n   "Pierre — DeepShift"\n\nRègles : Très court. Pas de "J'espère que", pas de formule creuse.`
      : `---\nSTRUCTURE OBLIGATOIRE pour la relance J+7 — dernier email (2 blocs) :\n\n1. SALUTATION\n   "Bonjour [Prénom],"\n\n2. MESSAGE (3-4 phrases max)\n   • Ton neutre, sans pression ni reproche\n   • Reconnaître que ce n'est peut-être pas le bon moment\n   • Laisser la porte ouverte\n   • Une seule question directe en fin de bloc\n\n3. SIGNATURE\n   "Pierre — DeepShift"\n\nRègles : Le plus court des trois emails. Pas de résumé de l'offre.`;

    const message = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Tu es Pierre Connes (DeepShift), freelance IT spécialisé en web apps et consulting digital.

Prospect :
- Prénom / Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin : ${prospect.needType.join(", ") || "non précisé"}
${prospect.companyDescription ? `- Contexte : ${prospect.companyDescription}` : ""}

Premier email envoyé (référence pour la relance) :
Objet : ${firstEmail.subject}
---
${firstEmail.body}

${structure}

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Re: [reprend l'objet du premier email]",
  "body": "Corps de la relance en respectant la structure"
}`,
      }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = parseAiJson<{ subject?: string; body?: string }>(raw, "process-followups") ?? {};

    if (!parsed.subject || !parsed.body) continue;

    const { gmailId } = await sendEmail({ to: prospect.email, subject: parsed.subject, body: parsed.body });
    await applyLabel(gmailId, "deepshift-prospect");

    await prisma.$transaction([
      prisma.email.create({
        data: {
          prospectId: prospect.id,
          direction: "SENT",
          subject: parsed.subject,
          body: parsed.body,
          sentAt: new Date(),
          gmailId,
        },
      }),
      prisma.prospect.update({
        where: { id: prospect.id },
        data: { lastContactedAt: new Date() },
      }),
    ]);

    followupNumber === 1 ? results.followup1++ : results.followup2++;
  }

  return NextResponse.json(results);
}
