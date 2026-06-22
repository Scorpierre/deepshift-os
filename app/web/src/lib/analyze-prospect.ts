import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/scrape";
import { MODEL_SONNET } from "@/config";

export async function analyzeProspect(prospectId: string) {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) { console.error("[analyzeProspect] prospect not found:", prospectId); return; }

  const url = prospect.websiteUrl ?? prospect.linkedinUrl;
  if (!url) { console.error("[analyzeProspect] no URL for prospect:", prospectId); return; }

  console.log("[analyzeProspect] scraping:", url);
  const scraped = await scrapeUrl(url);
  console.log("[analyzeProspect] scrape result:", scraped ? `${scraped.length} chars` : "null");
  const isFacebook = url.includes("facebook.com") || url.includes("fb.com");
  const sourceLabel = isFacebook ? "page Facebook" : "site web";
  const pageContent = scraped ?? "[Site inaccessible ou protégé — analyse basée sur les informations manuelles uniquement]";

  const message = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Tu analyses un prospect pour Pierre Connes (DeepShift) — développeur freelance solo qui crée des petits outils web sur mesure : formulaires intelligents, tableaux de bord internes, automatisations simples, sites vitrines. Pas de grosses plateformes, pas de CRM complexes, pas d'apps mobiles natives.

Prospect :
- Entreprise : ${prospect.company ?? prospect.name}
- Besoin exprimé : ${prospect.needType.join(", ") || "non précisé"}
${prospect.companyDescription ? `- Contexte : ${prospect.companyDescription}` : ""}

Contenu brut de leur ${sourceLabel} (scraping HTML statique — les éléments chargés en JavaScript comme les filtres, menus dynamiques ou formulaires interactifs peuvent être absents) :
---
${pageContent.slice(0, 3000)}
---

Génère une note terrain. Réponds UNIQUEMENT en JSON :
{
  "company_summary": "2 phrases max : ce que fait cette structure, sa taille estimée, son contexte — déduit du site",
  "detected_sector": "secteur précis (ex: brasserie artisanale, cabinet vétérinaire, association sportive) — déduit du site",
  "website_gap": "1 phrase sur un problème CERTAIN et visible dans le contenu scrappé (ex: aucun formulaire de contact, pas d'adresse ni de téléphone, site inaccessible, contenu très pauvre). Ne pas inférer l'absence d'éléments dynamiques (filtres, menus JS, etc.) qui peuvent exister sans apparaître dans le HTML statique. null si rien de certain.",
  "internal_pain": "1-2 phrases : raisonne depuis tes connaissances générales du secteur — PAS depuis le contenu du site. Pour une structure de ce type, quelle tâche interne répétitive est probablement encore gérée à la main ? Ex : suivi des stocks/commandes, gestion des plannings, saisie de devis, relances clients, rapports manuels... Reste dans le scope d'un outil simple."
}`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  let parsed: {
    company_summary?: string;
    internal_pain?: string;
    website_gap?: string;
    detected_sector?: string;
  } = {};
  try { parsed = JSON.parse(match?.[0] ?? "{}"); } catch { /* ignore */ }

  console.log("[analyzeProspect] parsed:", JSON.stringify(parsed).slice(0, 200));
  if (!parsed.company_summary) { console.error("[analyzeProspect] no company_summary in response"); return; }

  const summaryText = [
    parsed.company_summary,
    parsed.internal_pain ? `\nGestion interne : ${parsed.internal_pain}` : null,
    parsed.website_gap && parsed.website_gap !== "null" ? `\nSite web : ${parsed.website_gap}` : null,
    parsed.detected_sector ? `\nSecteur : ${parsed.detected_sector}` : null,
  ].filter(Boolean).join("\n");

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { aiSummary: summaryText },
  });
}
