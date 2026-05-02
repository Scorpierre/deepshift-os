import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_SONNET } from "@/config";

export async function POST(request: NextRequest) {
  const { prospectId } = await request.json();

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });

  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const message = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Tu es un expert en développement commercial. Tu évalues le potentiel de conclure un contrat avec ce prospect pour Pierre Connes (DeepShift), freelance IT spécialisé en sites web, web apps sur mesure et consulting digital pour PME/TPE/indépendants.

Prospect :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin exprimé : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}
- Budget estimé : ${prospect.estimatedBudget ? `${prospect.estimatedBudget} €` : "inconnu"}
${prospect.companyDescription ? `- Description / contexte : ${prospect.companyDescription}` : ""}

Donne un score de 1 à 10 représentant la probabilité de conclure un contrat :
- 9-10 : Très fort potentiel, besoin clair et budget probable
- 7-8 : Bon prospect, quelques inconnues
- 5-6 : Potentiel moyen, à qualifier
- 3-4 : Besoin flou ou budget insuffisant
- 1-2 : Peu probable

Réponds UNIQUEMENT en JSON :
{
  "score": 9,
  "reason": "PME avec besoin clair de refonte web, budget probable 5-15k€, urgence modérée.",
  "tags": ["site-vitrine", "pme", "restauration"],
  "recommended_action": "Proposer un call de 30min cette semaine"
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ score?: number; reason?: string; tags?: string[]; recommended_action?: string }>(raw, "score") ?? {};

  const score = typeof parsed.score === "number" ? Math.min(10, Math.max(1, Math.round(parsed.score))) : null;

  const updated = await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      score,
      aiScoreReason: parsed.reason ?? null,
      aiTags: parsed.tags ?? [],
      aiRecommendedAction: parsed.recommended_action ?? null,
    },
  });

  return NextResponse.json({ ...updated, tags: parsed.tags, recommended_action: parsed.recommended_action });
}
