import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

// Extrait le texte lisible d'une page HTML
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 6000);
}

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const html = await res.text();
    return extractText(html);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { prospectId, context } = await request.json();

  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  // Utilise les URLs enregistrées dans le profil (site prioritaire, sinon LinkedIn)
  const url = prospect.websiteUrl ?? prospect.linkedinUrl ?? null;
  let pageContent: string | null = null;
  let isFacebook = false;
  if (url) {
    pageContent = await fetchPageContent(url);
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
- Commence par montrer que tu as VRAIMENT regardé leur activité (cite un détail concret)
- Identifie un problème ou manque précis et propose une solution concrète
- 3 paragraphes max, ton naturel et direct, pas de jargon commercial
- Termine par une question ouverte simple pour engager la conversation
- En français, signature : "Pierre — DeepShift"

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
