import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_HAIKU } from "@/config";

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

  const structure =
    followupNumber === 1
      ? `---
STRUCTURE OBLIGATOIRE pour la relance J+3 (3 blocs, rien d'autre) :

1. SALUTATION
   "Bonjour [Prénom],"

2. RELANCE (2 phrases max)
   • Phrase 1 : une observation ou angle nouveau par rapport au premier email — pas une répétition, une perspective différente sur leur situation ou une question concrète sur leur besoin
   • Phrase 2 (optionnelle) : reformulation courte de la valeur apportée, sous un angle différent

3. CTA (1 question fermée oui/non)
   Varie légèrement par rapport au premier email (ex: "Avez-vous eu l'occasion d'y réfléchir ?" ou "Est-ce que le timing est bon de votre côté ?")

4. SIGNATURE
   "Pierre — DeepShift"

Règles : Très court. Pas de "J'espère que", pas de reproche, pas de formule creuse.`
      : `---
STRUCTURE OBLIGATOIRE pour la relance J+7 — dernier email (2 blocs, rien d'autre) :

1. SALUTATION
   "Bonjour [Prénom],"

2. MESSAGE (3-4 phrases max, tout en un bloc)
   • Ton neutre, sans pression, sans reproche
   • Reconnaître que ce n'est peut-être pas le bon moment
   • Laisser la porte ouverte clairement
   • Une seule question directe en fin de bloc

3. SIGNATURE
   "Pierre — DeepShift"

Règles : Le plus court des trois emails. Pas de résumé de l'offre. Porte ouverte uniquement.`;

  const message = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Tu es Pierre Connes (DeepShift), freelance IT spécialisé en web apps et consulting digital.

Prospect :
- Prénom / Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin : ${prospect.needType.join(", ") || "non précisé"}
${prospect.companyDescription ? `- Contexte : ${prospect.companyDescription}` : ""}

${firstEmail ? `Premier email envoyé (référence pour la relance) :
Objet : ${firstEmail.subject}
---
${firstEmail.body}` : "Aucun email précédent disponible."}

${structure}

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Re: [reprend l'objet du premier email]",
  "body": "Corps de la relance en respectant la structure"
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ subject?: string; body?: string }>(raw, "draft-followup") ?? {};

  return NextResponse.json(parsed);
}
