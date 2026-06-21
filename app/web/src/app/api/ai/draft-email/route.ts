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

  const companyContext = prospect.aiSummary
    ? `Analyse commerciale du prospect :\n---\n${prospect.aiSummary}\n---`
    : prospect.companyDescription
    ? `Description de l'entreprise :\n---\n${prospect.companyDescription}\n---`
    : "";

  const prospectContext = [
    companyContext,
    prospect.prospectNotes ? `Notes internes :\n${prospect.prospectNotes}` : "",
    context ? `Contexte additionnel : ${context}` : "",
    isFacebook ? `Note : seule présence en ligne = page Facebook (pas de site).` : "",
  ].filter(Boolean).join("\n\n");

  const message = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Tu es Pierre Connes (DeepShift), auto-entrepreneur IT spécialisé en outils de gestion sur mesure. Tu rédiges un email de prospection froide B2B.

Prospect :
- Entreprise : ${prospect.company ?? "inconnue"}
- Secteur / besoin : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}

${prospectContext}

---
ÉTAPE 1 — ANALYSE (ne pas écrire dans l'email) :
Pour CE type de structure, identifie 2-3 éléments de suivi ou de gestion qui sont probablement éparpillés entre plusieurs fichiers ou cahiers au quotidien. Ne prétends pas les connaître avec certitude — tu vas le formuler comme une hypothèse à vérifier.

---
ÉTAPE 2 — EMAIL (structure obligatoire) :

Salutation : "Bonjour,"

Phrase 1 — positionnement honnête :
"Je conçois des outils de gestion simples pour des structures qui manipulent beaucoup de données de suivi au quotidien, et je m'intéresse en ce moment aux [type de structure nommé précisément]."

Phrase 2 — hypothèse à vérifier :
"De ce que je comprends, [2-3 éléments de gestion spécifiques à leur métier] sont souvent répartis entre plusieurs fichiers et cahiers — mais je préfère le vérifier avec des gens du métier plutôt que de le supposer."

Question (FIXE, ne pas modifier) :
"Est-ce que ça correspond à votre réalité, ou je me trompe ? Je serais curieux de savoir comment vous gérez ça aujourd'hui."

Signature (FIXE) :
"Bien cordialement,

Pierre Connes
DeepShift

Vous pouvez me répondre « stop » si vous ne souhaitez plus être contacté."

Règles de style :
- 70 à 100 mots pour le corps
- Ton sobre, direct, curieux — pas de pitch, pas de vente
- Vouvoiement
- Pas de tirets (—) dans le corps, pas de listes à puces
- Pas de "J'espère que", pas de superlatifs

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet concret et non-commercial (6-8 mots, pas de majuscules inutiles)",
  "body": "Corps complet de l'email",
  "insights": ["hypothèse terrain 1", "hypothèse terrain 2"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ subject?: string; body?: string; insights?: string[] }>(raw, "draft-email") ?? {};

  return NextResponse.json({ ...parsed, scraped: !!prospect.aiSummary });
}
