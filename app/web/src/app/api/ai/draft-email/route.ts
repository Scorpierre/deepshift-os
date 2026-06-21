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
        content: `Tu es Pierre Connes, auto-entrepreneur IT (DeepShift — web apps sur mesure, outils de gestion et d'automatisation). Rédige un email de prospection froide en respectant EXACTEMENT la structure ci-dessous.

Prospect :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Secteur / besoin pressenti : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}

${prospectContext}
${facebookHint}

---
STRUCTURE OBLIGATOIRE (4 blocs, rien d'autre) :

1. SALUTATION
   "Bonjour,"
   (Pas de prénom — email froid, on ne sait pas à qui exactement on s'adresse dans la structure)

2. ACCROCHE (1 phrase)
   "Je me permets de vous contacter car je travaille sur des outils simples de gestion et d'automatisation pour des structures comme la vôtre."
   Cette phrase est FIXE, ne pas la modifier.

3. PROBLÈME SECTORIEL (2-3 phrases max)
   Identifie les problèmes opérationnels typiques des structures de CE SECTEUR — pas leur site web, pas leur présence en ligne.
   Pense : Excel partout, plusieurs outils séparés, tâches manuelles répétitives, suivi interne chronophage, reporting manuel, plannings gérés à la main, etc.
   Formule depuis leur point de vue ("beaucoup d'organisations de ce type...", "ce type de structure...").
   Reste concret et sectoriel — montre que tu connais leur métier, pas leur site.

4. CTA (1 question ouverte sur leur situation)
   "Est-ce que c'est quelque chose que vous rencontrez aussi dans votre fonctionnement actuel ?"
   Cette phrase est FIXE, ne pas la modifier.

5. SIGNATURE
   "Bien cordialement,\\nPierre — DeepShift"

Règles de style :
- Ton professionnel, sobre, entre deux pros
- Pas de "J'espère que", pas de superlatifs, pas de jargon marketing
- Pas de liste à puces dans l'email
- Pas de mention du site web ou de leur présence en ligne dans le corps du mail
- Phrases courtes

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet court (6-8 mots max, sobre, pas de majuscules inutiles)",
  "body": "Corps complet de l'email en respectant la structure",
  "insights": ["problème sectoriel identifié 1", "problème sectoriel identifié 2"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ subject?: string; body?: string; insights?: string[] }>(raw, "draft-email") ?? {};

  return NextResponse.json({ ...parsed, scraped: !!prospect.aiSummary });
}
