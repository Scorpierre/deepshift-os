import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_SONNET } from "@/config";

export async function POST(request: NextRequest) {
  const { prospectId, context } = await request.json();

  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  // Réutilise l'analyse déjà effectuée à la création du prospect (évite un double scraping + appel Claude)
  const url = prospect.websiteUrl ?? prospect.linkedinUrl ?? null;
  const isFacebook = url ? (url.includes("facebook.com") || url.includes("fb.com")) : false;
  const hasOnlinePresence = !!url;

  const companyContext = prospect.aiSummary
    ? `Analyse commerciale du prospect (déjà effectuée) :
---
${prospect.aiSummary}
---`
    : prospect.companyDescription
    ? `Description de l'entreprise :
---
${prospect.companyDescription}
---`
    : "";

  const opportunityHint = isFacebook
    ? `CONTEXTE CLEF : ils n'ont qu'une page Facebook comme présence en ligne. Dans l'observation d'ouverture, mentionne cette page Facebook et souligne concrètement ses limites (zéro référencement Google, pas de propriété du nom de domaine, dépendance totale à Meta). La solution : un vrai site web professionnel sur mesure.`
    : hasOnlinePresence && companyContext
    ? `Appuie-toi sur l'analyse commerciale pour formuler l'observation d'ouverture et identifier le problème central.`
    : `Pas de présence en ligne connue. Formule une observation sur leur secteur d'activité ou leurs besoins présumés.`;

  const prospectContext = [
    companyContext,
    prospect.prospectNotes ? `Notes internes sur ce prospect :\n${prospect.prospectNotes}` : "",
    context ? `Contexte additionnel : ${context}` : "",
  ].filter(Boolean).join("\n\n");

  const message = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Tu es Pierre Connes, auto-entrepreneur IT (DeepShift — web apps sur mesure et consulting digital). Rédige un email de prospection en respectant EXACTEMENT la structure ci-dessous.

Prospect :
- Prénom / Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin pressenti : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}

${prospectContext}

${opportunityHint}

---
STRUCTURE OBLIGATOIRE (4 blocs, rien d'autre) :

1. SALUTATION
   "Bonjour [Prénom],"

2. OBSERVATION (1 phrase)
   Commence par "J'ai regardé votre [site / page Facebook / profil LinkedIn] —" puis une observation concrète et spécifique sur leur activité, leur secteur ou leur présence en ligne. Jamais générique.

3. CORPS (2-3 phrases max, pas plus)
   • Phrase 1 : le problème ou l'opportunité identifié chez eux, formulé de leur point de vue
   • Phrase 2 : ce que DeepShift apporte concrètement (type de solution, bénéfice direct)
   • Phrase 3 (optionnelle) : 1 élément de preuve ou de crédibilité, court et factuel

4. CTA (1 question fermée)
   "Est-ce que c'est un sujet d'actualité pour vous ?"
   (Ne pas varier cette phrase — c'est volontaire.)

5. SIGNATURE
   "Pierre — DeepShift"

Règles de style :
- Ton professionnel et direct, entre deux pros — ni formel ni familier
- Pas de "J'espère que", pas de superlatifs, pas de jargon marketing
- Pas de liste à puces dans l'email
- Phrases courtes

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet court (6-8 mots max, pas de majuscules inutiles)",
  "body": "Corps complet de l'email en respectant la structure",
  "insights": ["observation clé 1 utilisée pour personnaliser", "observation clé 2"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ subject?: string; body?: string; insights?: string[] }>(raw, "draft-email") ?? {};

  return NextResponse.json({ ...parsed, scraped: !!prospect.aiSummary });
}
