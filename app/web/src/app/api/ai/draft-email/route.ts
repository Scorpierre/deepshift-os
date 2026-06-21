import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_SONNET } from "@/config";

export async function POST(request: NextRequest) {
  const { prospectId, context } = await request.json();

  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const url = prospect.websiteUrl ?? prospect.linkedinUrl ?? null;
  const isFacebook = url ? (url.includes("facebook.com") || url.includes("fb.com")) : false;
  const hasNoWebsite = !prospect.websiteUrl || isFacebook;
  const needsWebsite = hasNoWebsite || prospect.needType.includes("site") || prospect.needType.includes("ecommerce");
  const needsApp = prospect.needType.some((n) => ["webapp", "api", "consulting", "autre"].includes(n));

  // Si pas de site ou besoin explicite de site → angle présence web
  // Si besoin d'outil/app ou présence web connue → angle gestion/automatisation
  const angle: "web" | "gestion" = needsWebsite && !needsApp ? "web" : "gestion";

  const companyContext = prospect.aiSummary
    ? `Analyse commerciale du prospect :\n---\n${prospect.aiSummary}\n---`
    : prospect.companyDescription
    ? `Description de l'entreprise :\n---\n${prospect.companyDescription}\n---`
    : "";

  const prospectContext = [
    companyContext,
    prospect.prospectNotes ? `Notes internes :\n${prospect.prospectNotes}` : "",
    context ? `Contexte additionnel : ${context}` : "",
  ].filter(Boolean).join("\n\n");

  const emailInstructions = angle === "web"
    ? `
CONTEXTE : cette structure n'a pas de site web (ou seulement une page Facebook). Ne pas le mentionner comme une critique — formuler à partir de ce que ça leur fait perdre concrètement.

ÉTAPE 1 — ANALYSE :
Pour CE type de structure, identifie ce qu'un client cherche en ligne avant de les contacter ou de se déplacer (horaires, menu, services, tarifs, localisation...) et ce qu'il ne trouve pas sans site.

ÉTAPE 2 — EMAIL :

Salutation : "Bonjour,"

Phrase 1 — situation concrète :
"Je conçois des sites web simples pour des [type de structure nommé précisément] qui veulent être trouvés facilement en ligne."

Phrase 2 — hypothèse à vérifier :
"De ce que je comprends, quelqu'un qui vous cherche sur Google aujourd'hui trouve surtout votre page Facebook — mais pas toujours vos horaires, votre carte ou comment vous réserver. Mais je préfère le vérifier directement avec vous."

Question (FIXE) :
"Est-ce que ça correspond à votre situation, ou vous avez déjà quelque chose en place ?"

Signature (FIXE) :
"Bien cordialement,

Pierre Connes
DeepShift

Vous pouvez me répondre « stop » si vous ne souhaitez plus être contacté."
`
    : `
CONTEXTE : cette structure gère probablement des données de suivi complexes au quotidien et pourrait bénéficier d'un outil centralisé sur mesure.

ÉTAPE 1 — ANALYSE :
Pour CE type de structure précis, identifie 2-3 éléments de suivi ou de gestion qui sont probablement éparpillés entre plusieurs fichiers ou cahiers au quotidien. Formule-les comme une hypothèse à vérifier, pas comme une certitude.

ÉTAPE 2 — EMAIL :

Salutation : "Bonjour,"

Phrase 1 — positionnement honnête :
"Je conçois des outils de gestion simples pour des structures qui manipulent beaucoup de données de suivi au quotidien, et je m'intéresse en ce moment aux [type de structure nommé précisément]."

Phrase 2 — hypothèse à vérifier :
"De ce que je comprends, [2-3 éléments de gestion spécifiques à leur métier] sont souvent répartis entre plusieurs fichiers et cahiers — mais je préfère le vérifier avec des gens du métier plutôt que de le supposer."

Question (FIXE) :
"Est-ce que ça correspond à votre réalité, ou je me trompe ? Je serais curieux de savoir comment vous gérez ça aujourd'hui."

Signature (FIXE) :
"Bien cordialement,

Pierre Connes
DeepShift

Vous pouvez me répondre « stop » si vous ne souhaitez plus être contacté."
`;

  const message = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Tu es Pierre Connes (DeepShift), auto-entrepreneur IT. Tu rédiges un email de prospection froide B2B.

Prospect :
- Entreprise : ${prospect.company ?? "inconnue"}
- Secteur / besoin : ${prospect.needType.join(", ") || "non précisé"}

${prospectContext}

${emailInstructions}

Règles de style communes :
- 70 à 100 mots pour le corps
- Ton sobre, direct, curieux — pas de pitch, pas de vente
- Vouvoiement
- Pas de tirets (—) dans le corps, pas de listes à puces
- Pas de "J'espère que", pas de superlatifs

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet concret et non-commercial (6-8 mots, pas de majuscules inutiles)",
  "body": "Corps complet de l'email",
  "insights": ["observation clé 1", "observation clé 2"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ subject?: string; body?: string; insights?: string[] }>(raw, "draft-email") ?? {};

  return NextResponse.json({ ...parsed, scraped: !!prospect.aiSummary, angle });
}
