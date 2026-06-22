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
  primary_angle?: string;
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
- Entreprise : ${prospect.company || prospect.name || "inconnue"}
${prospect.needType.length > 0 ? `- Besoin exprimé : ${prospect.needType.join(", ")}` : ""}
- Source : ${prospect.source ?? "inconnue"}
- Budget estimé : ${prospect.estimatedBudget ? `${prospect.estimatedBudget} €` : "inconnu"}
${prospect.companyDescription ? `- Contexte : ${prospect.companyDescription}` : ""}

Contenu de leur ${sourceLabel} :
---
${pageContent.slice(0, 4000)}
---

DÉMARCHE D'ANALYSE (raisonne dans cet ordre avant de répondre) :
1. À partir du site, identifie ce que fait précisément la structure, son secteur exact et sa taille.
2. Identifie le CŒUR DE MÉTIER spécifique — ce que cette structure fait que nulle autre ne fait : un aquarium gère des espèces vivantes et des bassins, une brasserie gère des brassins et des recettes, un cabinet vétérinaire gère des dossiers patients animaux, etc.
3. Raisonne sur les processus liés à ce cœur de métier : suivi des stocks de matières premières, gestion des plannings de soin, traçabilité des interventions, tableaux de bord de production, relevés de données récurrents... Ignore les tâches administratives génériques (secrétariat, réservations basiques, comptabilité) qui sont déjà gérées par le personnel existant.
4. Déduis le goulot d'étranglement lié au cœur de métier : quelle donnée critique est encore suivie à la main (tableur, cahier, mémoire) et génère des erreurs ou une perte de temps réelle ?
5. Traduis ce problème en une opportunité concrète pour Pierre : quel petit outil sur mesure (tableau de bord, formulaire, automatisation) résoudrait ce problème mieux que n'importe quel logiciel générique ?

Réponds UNIQUEMENT en JSON :
{
  "company_summary": "2 phrases max : ce que fait cette structure, sa taille estimée, son contexte — déduit du site",
  "detected_sector": "secteur précis (ex: brasserie artisanale, cabinet vétérinaire, association sportive) — déduit du site",
  "website_gap": "1 phrase sur un problème réel observé sur le site (ex: aucun formulaire de contact, pas d'adresse, contenu très pauvre, pas de site). null si le site est fonctionnel.",
  "internal_pain": "1-2 phrases : le goulot d'étranglement lié au CŒUR DE MÉTIER (étapes 3-4). Pas de tâches génériques (secrétariat, réservations basiques). Vise ce que cette structure gère de spécifique à son activité principale.",
  "business_opportunity": "1 phrase : l'outil concret que Pierre pourrait construire pour résoudre internal_pain ou website_gap (étape 4). Ex : 'un tableau de bord de suivi des stocks par référence', 'un formulaire de réservation en ligne relié à un planning'.",
  "primary_angle": "angle commercial prioritaire — UNE valeur exacte parmi : 'site' (pas de site ou Facebook uniquement), 'refonte' (site existant mais clairement défaillant : outdated, contenu manquant, erreurs, pas de menu/carte/tarifs consultables), 'gestion' (site fonctionnel, opportunité principale = outil interne). Si website_gap est significatif, choisir 'site' ou 'refonte' plutôt que 'gestion'.",
  "score": 7,
  "reason": "1-2 phrases justifiant le score (potentiel de signer un contrat avec Pierre, au regard de l'opportunité identifiée)",
  "tags": ["secteur", "taille", "type-de-besoin"],
  "recommended_action": "1 phrase : prochaine action commerciale concrète"
}

Barème du score (1-10) — contexte : Pierre fait du démarchage cold, donc budget et besoin exprimés sont TOUJOURS inconnus. Ne pas pénaliser pour ça. Score basé uniquement sur l'opportunité détectée :
- 9-10 : Problème évident et coûteux à résoudre, structure de taille suffisante, outil de Pierre clairement adapté (ex: site inexistant pour un commerce actif, gestion critique encore sur papier)
- 7-8 : Problème probable et bien identifiable, structure réceptive, opportunité réaliste
- 5-6 : Opportunité possible mais floue ou secteur peu habitué aux outils numériques
- 3-4 : Problème peu visible, structure trop petite ou déjà bien équipée
- 1-2 : Aucune opportunité identifiable (administration rigide, déjà digitalisée, hors scope)`;

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
  if (score !== null && score >= 9) status = "VIP" as ProspectStatus;
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
      aiTags: [
        ...(parsed.tags ?? []),
        ...(parsed.primary_angle ? [`angle:${parsed.primary_angle}`] : []),
      ],
      aiRecommendedAction: parsed.recommended_action ?? null,
      ...(summaryText ? { aiSummary: summaryText } : {}),
    },
  });
}
