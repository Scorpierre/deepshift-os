import { ProspectStatus } from "@prisma/client";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/parse-ai-json";
import { scrapeUrl } from "@/lib/scrape";
import { MODEL_SONNET } from "@/config";

type AnalysisResult = {
  score?: number;
  reason?: string;
  tags?: string[];
  recommended_action?: string;
  company_summary?: string;
  detected_sector?: string;
  website_gap?: string;
  internal_pain?: string;
  business_opportunity?: string;
};

/**
 * Analyse complète d'un prospect en UN seul appel Sonnet :
 * - lit le site web (scraping direct)
 * - génère le score + raison + tags + action recommandée
 * - génère le résumé terrain (secteur, douleur interne, manque sur le site)
 * Met à jour le statut, le score et aiSummary.
 */
export async function analyzeProspect(prospectId: string) {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) { console.error("[analyzeProspect] prospect not found:", prospectId); return; }

  // URL du site : websiteUrl > linkedinUrl > domaine de l'email
  const emailDomain = prospect.email?.includes("@")
    ? `https://${prospect.email.split("@")[1]}`
    : null;
  const url = prospect.websiteUrl ?? prospect.linkedinUrl ?? emailDomain;

  let pageContent = "[Aucune URL — analyse basée sur les informations manuelles uniquement]";
  let sourceLabel = "site web";
  if (url) {
    const isFacebook = url.includes("facebook.com") || url.includes("fb.com");
    sourceLabel = isFacebook ? "page Facebook" : "site web";
    console.log("[analyzeProspect] scraping:", url);
    const scraped = await scrapeUrl(url);
    console.log("[analyzeProspect] scrape result:", scraped ? `${scraped.length} chars` : "null");
    pageContent = scraped ?? `[${sourceLabel} inaccessible ou protégé — analyse basée sur les informations manuelles uniquement]`;
  }

  const prompt = `Tu analyses un prospect pour Pierre Connes (DeepShift) — développeur freelance solo qui crée des petits outils web sur mesure : sites vitrines, formulaires intelligents, tableaux de bord internes, automatisations simples. Pas de grosses plateformes, pas de CRM complexes, pas d'apps mobiles natives.

Prospect :
- Entreprise : ${prospect.company ?? prospect.name}
${prospect.needType.length > 0 ? `- Besoin exprimé : ${prospect.needType.join(", ")}` : ""}
- Source : ${prospect.source ?? "inconnue"}
- Budget estimé : ${prospect.estimatedBudget ? `${prospect.estimatedBudget} €` : "inconnu"}
${prospect.companyDescription ? `- Contexte : ${prospect.companyDescription}` : ""}

Contenu de leur ${sourceLabel} :
---
${pageContent.slice(0, 4000)}
---

DÉMARCHE D'ANALYSE (raisonne dans cet ordre avant de répondre) :
1. À partir du site, identifie ce que fait précisément l'entreprise, son secteur et sa taille.
2. Croise ces observations avec tes connaissances générales du secteur : comment une structure de ce type fonctionne-t-elle au quotidien ? Quels sont ses processus internes typiques ?
3. Déduis le goulot d'étranglement le plus probable : quelle tâche répétitive ou quel suivi est encore géré à la main (tableur, papier, copier-coller) et leur fait perdre du temps ou génère des erreurs ?
4. Traduis ce problème en une opportunité concrète pour Pierre : quel petit outil sur mesure (formulaire, tableau de bord, automatisation, site vitrine) résoudrait ce problème ?

Réponds UNIQUEMENT en JSON :
{
  "company_summary": "2 phrases max : ce que fait cette structure, sa taille estimée, son contexte — déduit du site",
  "detected_sector": "secteur précis (ex: brasserie artisanale, cabinet vétérinaire, association sportive) — déduit du site",
  "website_gap": "1 phrase sur un problème réel observé sur le site (ex: aucun formulaire de contact, pas d'adresse, contenu très pauvre, pas de site). null si le site est fonctionnel.",
  "internal_pain": "1-2 phrases : le goulot d'étranglement opérationnel le plus probable (étape 3). Croise le secteur et ce que le site révèle de leur maturité/taille. Reste dans le scope d'un outil simple.",
  "business_opportunity": "1 phrase : l'outil concret que Pierre pourrait construire pour résoudre internal_pain ou website_gap (étape 4). Ex : 'un tableau de bord de suivi des stocks par référence', 'un formulaire de réservation en ligne relié à un planning'.",
  "score": 7,
  "reason": "1-2 phrases justifiant le score (potentiel de signer un contrat avec Pierre, au regard de l'opportunité identifiée)",
  "tags": ["secteur", "taille", "type-de-besoin"],
  "recommended_action": "1 phrase : prochaine action commerciale concrète"
}

Barème du score (1-10, probabilité de conclure un contrat) :
- 9-10 : Très fort potentiel, besoin clair et budget probable
- 7-8 : Bon prospect, quelques inconnues
- 5-6 : Potentiel moyen, à qualifier
- 3-4 : Besoin flou ou budget insuffisant
- 1-2 : Peu probable`;

  let parsed: AnalysisResult = {};
  try {
    const message = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = message.content[0]?.type === "text" ? message.content[0].text : "";
    parsed = parseAiJson<AnalysisResult>(raw, "analyzeProspect") ?? {};
  } catch (err) {
    console.error("[analyzeProspect] anthropic error:", err);
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { status: "SCORED" as ProspectStatus },
    }).catch(() => {});
    return;
  }

  console.log("[analyzeProspect] parsed:", JSON.stringify(parsed).slice(0, 200));

  const score = typeof parsed.score === "number"
    ? Math.min(10, Math.max(1, Math.round(parsed.score)))
    : null;

  let status: ProspectStatus;
  if (score !== null && score >= 8) status = "VIP" as ProspectStatus;
  else if (score !== null && score <= 3) status = "ARCHIVED" as ProspectStatus;
  else status = "SCORED" as ProspectStatus;

  const summaryText = [
    parsed.company_summary,
    parsed.internal_pain ? `\nGestion interne : ${parsed.internal_pain}` : null,
    parsed.website_gap && parsed.website_gap !== "null" ? `\nSite web : ${parsed.website_gap}` : null,
    parsed.business_opportunity ? `\nOpportunité : ${parsed.business_opportunity}` : null,
    parsed.detected_sector ? `\nSecteur : ${parsed.detected_sector}` : null,
  ].filter(Boolean).join("\n");

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      status,
      score,
      aiScoreReason: parsed.reason ?? null,
      aiTags: parsed.tags ?? [],
      aiRecommendedAction: parsed.recommended_action ?? null,
      ...(summaryText ? { aiSummary: summaryText } : {}),
    },
  });
}
