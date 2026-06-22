import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_SONNET } from "@/config";

export async function POST(request: NextRequest) {
  const { prospectId, context } = await request.json();

  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const firstName = prospect.name.trim().split(/\s+/)[0];

  const url = prospect.websiteUrl ?? prospect.linkedinUrl ?? null;
  const isFacebook = url ? (url.includes("facebook.com") || url.includes("fb.com")) : false;
  const hasNoWebsite = !prospect.websiteUrl || isFacebook;
  const needsApp = prospect.needType.some((n) => ["webapp", "api", "consulting", "autre"].includes(n));
  const needsSite = prospect.needType.includes("site") || prospect.needType.includes("ecommerce");

  const angle: "web" | "refonte" | "gestion" =
    needsApp ? "gestion"
    : hasNoWebsite || needsSite ? "web"
    : "refonte";

  const companyContext = prospect.aiSummary
    ? `Analyse du prospect :\n---\n${prospect.aiSummary}\n---`
    : prospect.companyDescription
    ? `Description :\n---\n${prospect.companyDescription}\n---`
    : "";

  const prospectContext = [
    companyContext,
    prospect.prospectNotes ? `Notes :\n${prospect.prospectNotes}` : "",
    context ? `Contexte : ${context}` : "",
  ].filter(Boolean).join("\n\n");

  const SIGNATURE = `Bien cordialement,\n\nPierre Connes\n\nDeepShift\n\nVous pouvez répondre « stop » si vous ne souhaitez plus être contacté.`;

  const emailInstructions = angle === "gestion"
    ? `
ÉTAPE 1 — ANALYSE :
Identifie pour CE type de structure :
- Leur contexte opérationnel précis (ex: "qui vendent aussi en ligne", "qui gèrent des plannings par équipe", "qui suivent des dossiers clients")
- 2-3 éléments de gestion qui finissent probablement éparpillés entre plusieurs fichiers ou cahiers
- Le bénéfice concret et visuel qu'un outil centralisé leur apporterait (formule avec "vous voyez en un coup d'œil...")
- La friction éliminée (ex: "sans ressaisir trois fois la même info", "sans jongler entre quatre onglets")

ÉTAPE 2 — EMAIL (3 paragraphes, rien d'autre) :

Salutation : "Bonjour ${firstName},"

Paragraphe 1 :
"Je conçois des outils de gestion simples pour les [type de structure précis] qui [contexte spécifique], là où [2-3 éléments concrets] finissent souvent éclatés entre plusieurs fichiers."

Paragraphe 2 :
"Concrètement, je centralise tout ça au même endroit : [bénéfice visuel et concret, ce que l'utilisateur voit en un coup d'œil] — sans [friction spécifique éliminée]."

Paragraphe 3 (FIXE) :
"Avant d'aller plus loin, je préfère partir de votre réalité que de la supposer : aujourd'hui, vous gérez ça plutôt sur un outil unique, ou sur plusieurs supports séparés ?"

Signature (FIXE) : "${SIGNATURE}"
`
    : angle === "web"
    ? `
ÉTAPE 1 — ANALYSE :
Identifie pour CE type de structure :
- Ce qu'un client cherche en ligne avant de les contacter ou de se déplacer (horaires, menu, services, tarifs...)
- Ce qu'il ne trouve pas ou trouve difficilement sans site web
- Le bénéfice visuel d'avoir un site (ex: "votre client voit vos horaires, votre carte et peut vous appeler en deux clics")
- La friction actuelle (ex: "sans passer par votre page Facebook")

ÉTAPE 2 — EMAIL (3 paragraphes) :

Salutation : "Bonjour ${firstName},"

Paragraphe 1 :
"Je conçois des sites web simples pour les [type de structure] qui veulent être trouvés facilement en ligne, là où une page Facebook seule laisse souvent [ce que le client ne trouve pas] dans le flou."

Paragraphe 2 :
"Concrètement, quelqu'un qui vous cherche sur Google [bénéfice visuel et concret] — sans [friction actuelle]."

Paragraphe 3 (FIXE) :
"Avant d'aller plus loin, je préfère partir de votre réalité que de la supposer : aujourd'hui, vous gérez votre présence en ligne comment ?"

Signature (FIXE) : "${SIGNATURE}"
`
    : `
ÉTAPE 1 — ANALYSE :
Tu dois évaluer honnêtement ce que le site de ce prospect fait probablement bien ou mal pour CE secteur.
Identifie :
- Ce que le site devrait idéalement faire pour eux (générer des contacts, être trouvé sur Google, convaincre un visiteur)
- Ce qui manque probablement (SEO, mobile, formulaire de contact, clarté de l'offre)
- Le bénéfice visuel si c'était optimisé (ex: "un visiteur comprend en 10 secondes ce que vous faites et peut vous appeler directement")
- La friction actuelle (ex: "sans chercher dans trois menus différents")

ÉTAPE 2 — EMAIL (3 paragraphes) :

Salutation : "Bonjour ${firstName},"

Paragraphe 1 :
"Je travaille sur des sites et présences en ligne pour les [type de structure], là où [problème courant dans ce secteur] freine souvent les prises de contact directes."

Paragraphe 2 :
"Concrètement, [bénéfice visuel et concret d'un site bien fait pour eux] — sans [friction actuelle]."

Paragraphe 3 (FIXE) :
"Avant d'aller plus loin, je préfère partir de votre réalité que de la supposer : est-ce que votre site vous génère des contacts régulièrement, ou c'est plutôt anecdotique ?"

Signature (FIXE) : "${SIGNATURE}"
`;

  const message = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Tu es Pierre Connes (DeepShift), développeur freelance solo. Tu rédiges un email de prospection froide B2B.

Prospect :
- Prénom utilisé dans la salutation : ${firstName}
- Entreprise : ${prospect.company ?? "inconnue"}
- Secteur / besoin : ${prospect.needType.join(", ") || "non précisé"}

${prospectContext}

${emailInstructions}

Règles de style :
- 80 à 120 mots pour le corps
- Ton sobre, direct, concret — pas de pitch agressif
- Vouvoiement
- Pas de tirets (—) dans le corps, pas de listes à puces
- Pas de "J'espère que", pas de superlatifs

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet concret et non-commercial (6-8 mots, pas de majuscules inutiles)",
  "body": "Corps complet de l'email",
  "insights": ["élément clé identifié 1", "élément clé identifié 2"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ subject?: string; body?: string; insights?: string[] }>(raw, "draft-email") ?? {};

  return NextResponse.json({ ...parsed, scraped: !!prospect.aiSummary, angle });
}
