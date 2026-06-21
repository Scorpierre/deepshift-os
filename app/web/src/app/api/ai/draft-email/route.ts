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
    isFacebook ? `Note : seule présence en ligne = page Facebook (pas de site). À utiliser comme contexte secteur, ne pas critiquer dans l'email.` : "",
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
Identifie pour CE type de structure précis :
- Quelles données gèrent-ils au quotidien ? (fiches, stocks, registres, plannings, suivis...)
- Quelles tâches sont probablement manuelles ou éparpillées sur plusieurs supports ?
- Quel détail concret et vivant montre que tu connais leur métier ?

---
ÉTAPE 2 — EMAIL (structure obligatoire) :

Salutation : "Bonjour,"

Corps (2-3 phrases) :
- Ouvre directement sur leur réalité quotidienne, pas sur toi ni sur DeepShift
- Cite 2-3 éléments de gestion concrets et spécifiques à CE métier
- Inclus un détail précis et vivant (pas abstrait) tiré de l'étape 1
- Pas de tirets, pas de listes, pas de superlatifs

Positionnement (1 phrase) :
"Je conçois des outils simples pour centraliser tout ça pour les [type de structure nommé précisément]."

Question (FIXE, ne pas modifier) :
"Question rapide : aujourd'hui, vous gérez ça plutôt sur un outil centralisé, ou sur plusieurs supports ?"

Signature (FIXE) :
"Bien cordialement,

Pierre Connes
DeepShift

Vous pouvez me répondre « stop » si vous ne souhaitez plus être contacté."

Règles de style :
- 80 à 120 mots pour le corps
- Ton sobre, direct, vouvoiement
- Pas de tirets (—) dans le corps, pas de listes à puces
- Pas de "Je me permets", "J'espère que", "je travaille sur"

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet concret et non-commercial (6-8 mots, pas de majuscules inutiles)",
  "body": "Corps complet de l'email",
  "insights": ["élément terrain identifié 1", "élément terrain identifié 2"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ subject?: string; body?: string; insights?: string[] }>(raw, "draft-email") ?? {};

  return NextResponse.json({ ...parsed, scraped: !!prospect.aiSummary });
}
