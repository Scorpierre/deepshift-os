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

Avant de rédiger, pose-toi ces questions sur cette structure spécifique :
- Qu'est-ce que cette organisation gère au quotidien en interne ? (stocks, plannings, fiches, suivis, registres...)
- Quelles sont les tâches répétitives propres à CE métier précis ? (pas au secteur en général)
- Quels outils utilisent-ils probablement aujourd'hui pour ces tâches ? (Excel, cahiers, logiciels métier génériques...)
- Où est la friction la plus évidente pour eux ?

Exemple pour un aquarium : suivi de la santé et de l'alimentation de chaque animal, inventaire des espèces et renouvellement du stock, registre des soins vétérinaires, plannings de nourrissage par bassin, maintenance des installations techniques.
NE PAS parler de "réservations de groupes" ou "gestion d'événements" sauf si c'est vraiment le cœur de leur activité.

---
ÉTAPE 2 — RÉDACTION (structure obligatoire, 4 blocs) :

1. SALUTATION
   "Bonjour,"

2. ACCROCHE (1 phrase)
   "Je me permets de vous contacter car je travaille sur des outils simples de gestion pour des structures comme [type de structure précis]."
   Le type de structure doit être nommé précisément d'après leur activité (ex: "les aquariums", "les cabinets vétérinaires", "les associations culturelles") — jamais "comme la vôtre" ou générique.

3. OBSERVATION (1-2 phrases)
   "Dans ce type d'environnement, le suivi des informations ([liste courte de 3-4 éléments spécifiques à leur métier]) est souvent réparti entre plusieurs supports, ce qui peut rendre la centralisation et le suivi quotidien assez complexes."
   Les éléments entre parenthèses doivent être propres à leur activité réelle, tirés de l'analyse de l'étape 1. Pas de généralités.

4. CTA (1 question de découverte — FIXE, ne pas modifier)
   "Est-ce que vous utilisez aujourd'hui un outil centralisé pour ce suivi, ou plutôt plusieurs supports (Excel, cahiers, logiciels séparés) ?"

5. SIGNATURE
   "Bien cordialement,\nPierre — DeepShift"

Règles de style :
- Ton sobre et direct, entre deux pros
- Pas de pitch, pas de vente, pas de solution proposée — juste ouvrir une discussion
- Pas de "J'espère que", pas de superlatifs, pas de jargon marketing
- Pas de liste à puces dans le corps du mail
- Phrases courtes

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet court (6-8 mots max, sobre)",
  "body": "Corps complet de l'email en respectant la structure",
  "insights": ["élément métier spécifique identifié 1", "élément métier spécifique identifié 2"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ subject?: string; body?: string; insights?: string[] }>(raw, "draft-email") ?? {};

  return NextResponse.json({ ...parsed, scraped: !!prospect.aiSummary });
}
