import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/scrape";

export async function analyzeProspect(prospectId: string) {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return;

  const url = prospect.websiteUrl ?? prospect.linkedinUrl;
  if (!url) return;

  const scraped = await scrapeUrl(url);
  const isFacebook = url.includes("facebook.com") || url.includes("fb.com");
  const sourceLabel = isFacebook ? "page Facebook" : "site web";
  const pageContent = scraped ?? "[Site inaccessible ou protégé — analyse basée sur les informations manuelles uniquement]";

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Tu es un expert en développement commercial pour DeepShift (web apps sur mesure, consulting digital pour PME/TPE/indépendants — fondateur : Pierre Connes).

Analyse la ${sourceLabel} de ce prospect et génère une note commerciale synthétique.

Infos renseignées sur le prospect :
- Entreprise : ${prospect.company ?? prospect.name}
- Besoin exprimé : ${prospect.needType.join(", ") || "non précisé"}
- Budget estimé : ${prospect.estimatedBudget ? `${prospect.estimatedBudget} €` : "inconnu"}
- Source : ${prospect.source ?? "inconnue"}
${prospect.companyDescription ? `- Contexte : ${prospect.companyDescription}` : ""}
${prospect.score ? `- Score potentiel : ${prospect.score}/10` : ""}

Contenu de leur ${sourceLabel} :
---
${pageContent.slice(0, 3000)}
---

Génère une note commerciale. Réponds UNIQUEMENT en JSON :
{
  "company_summary": "2-3 phrases : secteur d'activité, taille estimée, ce que fait l'entreprise",
  "commercial_note": "3-4 phrases : potentiel pour DeepShift, besoins digitaux détectés sur le site, points d'accroche spécifiques à mentionner dans l'approche commerciale",
  "opportunities": ["opportunité concrète 1", "opportunité concrète 2"],
  "digital_maturity": "faible | moyenne | élevée",
  "detected_sector": "secteur détecté"
}`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  let parsed: {
    company_summary?: string;
    commercial_note?: string;
    opportunities?: string[];
    digital_maturity?: string;
    detected_sector?: string;
  } = {};
  try { parsed = JSON.parse(match?.[0] ?? "{}"); } catch { /* ignore */ }

  if (!parsed.company_summary && !parsed.commercial_note) return;

  const summaryText = [
    parsed.company_summary,
    parsed.commercial_note ? `\n${parsed.commercial_note}` : null,
    parsed.opportunities?.length
      ? `\nOpportunités : ${parsed.opportunities.join(" · ")}`
      : null,
    parsed.digital_maturity
      ? `Maturité digitale : ${parsed.digital_maturity}`
      : null,
    parsed.detected_sector
      ? `Secteur : ${parsed.detected_sector}`
      : null,
  ].filter(Boolean).join("\n");

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { aiSummary: summaryText },
  });
}
