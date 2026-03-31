import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

/**
 * Génère une relance email pour un prospect qui n'a pas répondu.
 * followupNumber: 1 = J+3 (relance douce), 2 = J+7 (dernier essai)
 */
export async function POST(request: NextRequest) {
  const { prospectId, followupNumber } = await request.json();

  if (followupNumber !== 1 && followupNumber !== 2) {
    return NextResponse.json({ error: "followupNumber must be 1 or 2" }, { status: 400 });
  }

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: {
      emails: {
        where: { direction: "SENT" },
        orderBy: { sentAt: "asc" },
        take: 1,
      },
    },
  });

  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const firstEmail = prospect.emails[0];

  const instructions =
    followupNumber === 1
      ? `C'est une PREMIÈRE RELANCE (J+3). Le prospect n'a pas répondu à ton premier email.
Règles :
- Très court : 2 paragraphes max
- Ton professionnel et direct, sans formules creuses
- Apporte un angle différent du premier email ou pose une question concrète
- Termine par une question fermée simple (oui/non)
- Signature : "Pierre — DeepShift"`
      : `C'est la DEUXIÈME et DERNIÈRE RELANCE (J+7). Le prospect n'a toujours pas répondu.
Règles :
- 3-4 phrases maximum
- Ton neutre et professionnel, sans reproche ni fausse chaleur
- Porte ouverte sans pression
- Une seule question directe
- Signature : "Pierre — DeepShift"`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Tu es Pierre Connes (DeepShift), freelance IT spécialisé en web apps et consulting digital.

Prospect :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin : ${prospect.needType.join(", ") || "non précisé"}
${prospect.companyDescription ? `- Contexte : ${prospect.companyDescription}` : ""}

${firstEmail ? `Premier email envoyé :
Objet : ${firstEmail.subject}
Contenu : ${firstEmail.body}` : "Aucun email précédent disponible."}

${instructions}

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Re: [objet court]",
  "body": "Corps de la relance"
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let parsed: { subject?: string; body?: string } = {};
  try {
    parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
  } catch {
    // fallback
  }

  return NextResponse.json(parsed);
}
