import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/scrape";

export async function POST(request: NextRequest) {
  const { prospectId, context } = await request.json();

  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  // Utilise les URLs enregistrées dans le profil (site prioritaire, sinon LinkedIn)
  const url = prospect.websiteUrl ?? prospect.linkedinUrl ?? null;
  let pageContent: string | null = null;
  let isFacebook = false;
  if (url) {
    pageContent = await scrapeUrl(url);
    isFacebook = url.includes("facebook.com") || url.includes("fb.com");
  }

  const companyContext = pageContent
    ? `Contenu de leur présence en ligne (${isFacebook ? "page Facebook" : "site web"}) :
---
${pageContent}
---`
    : "";

  const opportunityHint = isFacebook
    ? `IMPORTANT : ils n'ont qu'une page Facebook — c'est une opportunité claire pour proposer un vrai site web professionnel. Mentionne concrètement les limites d'une page FB (référencement nul, pas de propriété, dépendance à Meta) et la valeur d'un site sur mesure.`
    : pageContent
    ? `Analyse leur site et identifie 1-2 points d'amélioration concrets ou opportunités (design daté, pas de SEO visible, site non responsive, pas de tunnel de conversion, etc.) et mentionne-les naturellement dans l'email.`
    : "";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Tu es Pierre Connes, auto-entrepreneur IT (DeepShift) spécialisé en web apps sur mesure et consulting digital. Rédige un email de prospection hyper-personnalisé.

Prospect :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin pressenti : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}
${context ? `- Contexte : ${context}` : ""}

${companyContext}

${opportunityHint}

Règles pour l'email :
- Ton : professionnel et direct, comme un mail entre deux pros — ni trop formel ni familier
- Pas de "J'espère que ce message vous trouve en bonne santé", pas de superlatifs, pas de jargon marketing
- Commence par une observation concrète sur leur activité (1 phrase)
- Identifie clairement un problème ou une opportunité, propose brièvement ce que tu peux apporter
- 3 paragraphes max, phrases courtes
- Termine par une question simple et directe
- Signature : "Pierre — DeepShift"

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet court et accrocheur",
  "body": "Corps de l'email complet",
  "insights": ["observation 1 sur leur présence en ligne", "observation 2"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";

  // Extraire le JSON même si Claude ajoute du texte autour
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let parsed: { subject?: string; body?: string; insights?: string[] } = {};
  try {
    parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
  } catch {
    // fallback
  }

  return NextResponse.json({ ...parsed, scraped: !!pageContent });
}
