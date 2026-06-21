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

  const prospectContext = [
    companyContext,
    prospect.prospectNotes ? `Notes internes sur ce prospect :\n${prospect.prospectNotes}` : "",
    context ? `Contexte additionnel : ${context}` : "",
  ].filter(Boolean).join("\n\n");

  const facebookHint = isFacebook
    ? `Note : leur seule présence en ligne est une page Facebook. C'est pertinent pour identifier un besoin potentiel (pas de site = pas de référencement, pas de crédibilité en ligne), mais NE PAS le mentionner comme une critique dans l'email — l'intégrer comme contexte pour formuler le problème sectoriel.`
    : "";

  const message = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Tu es Pierre Connes, auto-entrepreneur IT (DeepShift — web apps sur mesure, outils de gestion et d'automatisation). Tu vas rédiger un email de prospection froide.

Prospect :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Secteur / besoin pressenti : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}

${prospectContext}
${facebookHint}

---
ÉTAPE 1 — ANALYSE INTERNE (ne pas écrire dans l'email, juste raisonner) :

Identifie pour CE type de structure précis :
- Quelles données gèrent-ils au quotidien ? (stocks, fiches, registres, plannings, suivis...)
- Quelles tâches sont probablement encore manuelles ou réparties sur plusieurs supports ?
- Quel est le détail concret et vivant qui montre que tu connais leur métier ? (pas une généralité)

---
ÉTAPE 2 — RÉDACTION (structure obligatoire) :

1. SALUTATION : "Bonjour,"

2. RÉALITÉ TERRAIN (1-2 phrases)
   Ouvre directement sur leur quotidien — pas sur DeepShift, pas sur toi.
   Cite 2-3 éléments de gestion très concrets et spécifiques à CE métier.
   Inclus 1 détail précis et vivant issu de l'étape 1 (pas abstrait).
   Termine par une micro-légitimité : "c'est ce que je rencontre dans ce type de structure" ou "après avoir échangé avec plusieurs [type de structure]".
   Pas de tirets, pas de listes à puces.

3. POSITIONNEMENT (1 phrase)
   "Je conçois des outils simples pour centraliser tout ça pour les [type de structure nommé précisément], sans usine à gaz."

4. QUESTION (FIXE)
   "Question rapide : aujourd'hui, vous gérez ça plutôt sur un outil centralisé, ou sur plusieurs supports ?"

5. SIGNATURE + RGPD
   "Bien cordialement,\n\nPierre Connes\nDeepShift\n\nVous pouvez me répondre « stop » si vous ne souhaitez plus être contacté."

STYLE :
- 90 à 130 mots pour le corps
- Ton sobre et direct, vouvoiement
- Pas de tirets (—) dans le corps, pas de listes, pas de superlatifs
- Pas de "Je me permets", "J'espère que", "je travaille sur"

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet concret et non-commercial (6-8 mots, pas de majuscules inutiles)",
  "body": "Corps complet de l'email",
  "insights": ["élément terrain spécifique 1", "élément terrain spécifique 2"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ subject?: string; body?: string; insights?: string[] }>(raw, "draft-email") ?? {};

  return NextResponse.json({ ...parsed, scraped: !!prospect.aiSummary });
}
