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
        content: `Tu es un expert en développement commercial. Tu évalues le potentiel business d'un prospect pour Pierre Connes (DeepShift), freelance IT qui crée des sites web, web apps sur mesure et fait du consulting digital pour des PME/TPE/indépendants.

Pierre peut apporter de la valeur à une entreprise si :
- Elle n'a pas de site web ou seulement une page Facebook/Instagram (opportunité énorme)
- Son site est daté, non mobile, lent ou sans tunnel de conversion
- Elle a besoin d'une web app, d'une automatisation ou d'une intégration API
- C'est une PME/TPE avec un vrai CA mais peu de présence digitale
- Elle est dans un secteur où le digital fait la différence (restauration, artisanat, commerce local, services, immobilier, santé, etc.)

Pierre NE peut PAS apporter de valeur si :
- C'est une grande entreprise tech (Salesforce, Google, SAP, Oracle…) qui a déjà ses équipes
- C'est une agence web / boîte IT concurrente
- C'est un particulier sans budget
- L'entreprise a déjà une présence digitale solide et des développeurs en interne

Prospect à analyser :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin exprimé : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}
- Budget estimé : ${prospect.estimatedBudget ? `${prospect.estimatedBudget} €` : "inconnu"}
${prospect.companyDescription ? `- Description / contexte : ${prospect.companyDescription}` : ""}
- Premier contact : ${firstEmail?.body ?? "aucun email disponible"}

Donne un score de 0 à 10 représentant le potentiel de chiffre d'affaires pour DeepShift :
- 9-10 : Client idéal, besoin évident, budget probable, Pierre peut transformer leur situation
- 7-8 : Bon prospect, besoin réel, quelques inconnues
- 5-6 : Potentiel moyen, à qualifier
- 3-4 : Peu probable, besoin flou ou budget insuffisant
- 0-2 : Pas de valeur ajoutée possible pour DeepShift

Réponds UNIQUEMENT en JSON :
{
  "score": 9,
  "reason": "Restaurant avec 80k€ de CA annuel et seulement une page Facebook — pas de site, zéro présence Google. Pierre peut leur apporter un vrai site vitrine + réservation en ligne pour un contrat 2-4k€.",
  "tags": ["site-vitrine", "pme", "restauration"],
  "recommended_action": "Contacter rapidement avec une démo de ce que leur site pourrait ressembler"
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let parsed: { score?: number; reason?: string; tags?: string[]; recommended_action?: string } = {};
  try {
    parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
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
