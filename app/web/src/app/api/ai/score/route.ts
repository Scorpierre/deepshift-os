import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { prospectId } = await request.json();

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: { emails: { take: 1, orderBy: { sentAt: "asc" } } },
  });

  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const firstEmail = prospect.emails[0];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Tu analyses un prospect pour DeepShift, auto-entreprise IT spécialisée en web apps sur mesure et consulting transformation digitale.

Prospect :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin exprimé : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}
- Email initial : ${firstEmail?.body ?? "aucun email disponible"}

Score de 1 à 10 selon ces critères :
- Fit avec les services DeepShift (web app, consulting digital) : /4
- Budget apparent (taille entreprise, secteur, signaux) : /3
- Urgence détectée : /2
- Facilité de collaboration estimée : /1

Réponds UNIQUEMENT en JSON :
{
  "score": 7,
  "reason": "PME avec besoin clair de refonte web, budget probable 5-15k, urgence modérée",
  "tags": ["webapp", "pme", "refonte"],
  "recommended_action": "Proposer un call de 30min cette semaine"
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  let parsed: { score?: number; reason?: string; tags?: string[]; recommended_action?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // parsing failed
  }

  const updated = await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      score: parsed.score ?? null,
      aiScoreReason: parsed.reason ?? null,
    },
  });

  return NextResponse.json({ ...updated, tags: parsed.tags, recommended_action: parsed.recommended_action });
}
