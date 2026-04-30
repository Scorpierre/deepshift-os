import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { sendEmail, applyLabel } from "@/lib/gmail";

const J3 = 3 * 24 * 60 * 60 * 1000;
const J7 = 7 * 24 * 60 * 60 * 1000;
const J10 = 10 * 24 * 60 * 60 * 1000;

/**
 * Appelé par n8n chaque mardi/mercredi/jeudi à 9h.
 * - Relance J+3 et J+7 : génère et envoie les emails de relance
 * - Auto-lost J+10 : passe en LOST les prospects sans réponse après 3 emails
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-n8n-secret") !== process.env.N8N_WEBHOOK_SECRET) {
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
    if (sentEmails.length >= 3 && timeSinceLast >= J10) {
      await prisma.prospect.update({ where: { id: prospect.id }, data: { status: "LOST" } });
      results.autoLost++;
      continue;
    }

    const followupNumber =
      sentEmails.length === 1 && timeSinceLast >= J3 ? 1
      : sentEmails.length === 2 && timeSinceLast >= J7 ? 2
      : null;

    if (!followupNumber) continue;

    const firstEmail = sentEmails[0];
    const instructions = followupNumber === 1
      ? `C'est une PREMIÈRE RELANCE (J+3). Le prospect n'a pas répondu.\n- Très court : 2 paragraphes max\n- Apporte un angle différent ou pose une question concrète\n- Termine par une question fermée (oui/non)\n- Signature : "Pierre — DeepShift"`
      : `C'est la DEUXIÈME et DERNIÈRE RELANCE (J+7). Le prospect n'a toujours pas répondu.\n- 3-4 phrases maximum\n- Ton neutre, porte ouverte sans pression\n- Une seule question directe\n- Signature : "Pierre — DeepShift"`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Tu es Pierre Connes (DeepShift), freelance IT spécialisé en web apps et consulting digital.

Prospect :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin : ${prospect.needType.join(", ") || "non précisé"}
${prospect.companyDescription ? `- Contexte : ${prospect.companyDescription}` : ""}

Premier email envoyé :
Objet : ${firstEmail.subject}
Contenu : ${firstEmail.body}

${instructions}

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Re: [objet court]",
  "body": "Corps de la relance"
}`,
      }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed: { subject?: string; body?: string } = {};
    try { parsed = JSON.parse(jsonMatch?.[0] ?? "{}"); } catch { /* fallback */ }

    if (!parsed.subject || !parsed.body) continue;

    const { gmailId } = await sendEmail({ to: prospect.email, subject: parsed.subject, body: parsed.body });
    await applyLabel(gmailId, "deepshift-prospect");

    await prisma.email.create({
      data: {
        prospectId: prospect.id,
        direction: "SENT",
        subject: parsed.subject,
        body: parsed.body,
        sentAt: new Date(),
        gmailId,
      },
    });

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { lastContactedAt: new Date() },
    });

    followupNumber === 1 ? results.followup1++ : results.followup2++;
  }

  return NextResponse.json(results);
}
