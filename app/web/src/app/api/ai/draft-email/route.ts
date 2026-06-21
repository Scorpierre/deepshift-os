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
  const needsApp = prospect.needType.some((n) => ["webapp", "api", "consulting", "autre"].includes(n));
  const needsSite = prospect.needType.includes("site") || prospect.needType.includes("ecommerce");

  // "web"     → pas de site ou page FB seulement
  // "refonte" → site existant, pas de besoin app explicite (Claude juge si le site est suffisant)
  // "gestion" → besoin app/outil explicite
  const angle: "web" | "refonte" | "gestion" =
    needsApp ? "gestion"
    : hasNoWebsite || needsSite ? "web"
    : "refonte";

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

  const SIGNATURE = `Bien cordialement,\n\nPierre Connes\nDeepShift\n\nVous pouvez me répondre « stop » si vous ne souhaitez plus être contacté.`;

  const emailInstructions = angle === "web"
    ? `
CONTEXTE : cette structure n'a pas de site web (ou seulement une page Facebook). Formuler à partir de ce que ça leur fait perdre concrètement, pas comme une critique.

ÉTAPE 1 — ANALYSE :
Identifie ce qu'un client cherche en ligne avant de contacter ce type de structure (horaires, services, tarifs, localisation...) et ce qu'il ne trouve pas sans site.

ÉTAPE 2 — EMAIL :

Salutation : "Bonjour,"

Phrase 1 : "Je conçois des sites web simples pour des [type de structure] qui veulent être trouvés facilement en ligne."

Phrase 2 — hypothèse : "De ce que je comprends, quelqu'un qui vous cherche sur Google aujourd'hui trouve surtout votre page Facebook — mais pas toujours [1-2 infos clés spécifiques à leur secteur]. Mais je préfère le vérifier directement avec vous."

Question (FIXE) : "Est-ce que ça correspond à votre situation, ou vous avez déjà quelque chose en place ?"

Signature (FIXE) : "${SIGNATURE}"
`
    : angle === "refonte"
    ? `
CONTEXTE : cette structure a un site web (${prospect.websiteUrl}). L'objectif n'est pas de critiquer le site mais d'ouvrir une discussion sur ce qu'il leur rapporte réellement — contacts, clients, visibilité.

ÉTAPE 1 — ANALYSE :
Pour CE type de structure et CE secteur, réfléchis à ce qu'un site web devrait idéalement faire (générer des contacts, être trouvé sur Google, convaincre un visiteur de passer à l'action) et formule une hypothèse honnête sur ce que beaucoup de sites dans ce secteur ne font pas encore bien.

ÉTAPE 2 — EMAIL :

Salutation : "Bonjour,"

Phrase 1 : "Je travaille sur des sites web et des améliorations de présence en ligne pour des [type de structure], et je m'intéresse en ce moment à votre secteur."

Phrase 2 — hypothèse : "De ce que je comprends, beaucoup de sites dans ce domaine sont peu optimisés pour [point spécifique au secteur : Google, mobile, prise de contact, conversion...] — mais je préfère vérifier avec vous plutôt que de supposer."

Question (FIXE) : "Est-ce que votre site vous génère des contacts régulièrement, ou c'est plutôt anecdotique ?"

Signature (FIXE) : "${SIGNATURE}"
`
    : `
CONTEXTE : cette structure a besoin d'un outil sur mesure pour centraliser ou automatiser une partie de sa gestion interne.

ÉTAPE 1 — ANALYSE :
Pour CE type de structure précis, identifie 2-3 éléments de suivi ou de gestion probablement éparpillés entre plusieurs fichiers ou cahiers. Formule une hypothèse à vérifier, pas une certitude.

ÉTAPE 2 — EMAIL :

Salutation : "Bonjour,"

Phrase 1 : "Je conçois des outils de gestion simples pour des structures qui manipulent beaucoup de données de suivi au quotidien, et je m'intéresse en ce moment aux [type de structure]."

Phrase 2 — hypothèse : "De ce que je comprends, [2-3 éléments spécifiques à leur métier] sont souvent répartis entre plusieurs fichiers et cahiers — mais je préfère le vérifier avec des gens du métier plutôt que de le supposer."

Question (FIXE) : "Est-ce que ça correspond à votre réalité, ou je me trompe ? Je serais curieux de savoir comment vous gérez ça aujourd'hui."

Signature (FIXE) : "${SIGNATURE}"
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
