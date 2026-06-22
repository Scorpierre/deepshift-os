import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { MODEL_SONNET } from "@/config";

const WEB_FETCH_TOOL = { type: "web_fetch_20260209" } as unknown as Anthropic.Tool;

export async function analyzeProspect(prospectId: string) {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) { console.error("[analyzeProspect] prospect not found:", prospectId); return; }

  const url = prospect.websiteUrl ?? prospect.linkedinUrl;
  if (!url) { console.error("[analyzeProspect] no URL for prospect:", prospectId); return; }

  const isFacebook = url.includes("facebook.com") || url.includes("fb.com");
  const sourceLabel = isFacebook ? "page Facebook" : "site web";

  const userPrompt = `Tu analyses un prospect pour Pierre Connes (DeepShift) — développeur freelance solo qui crée des petits outils web sur mesure : formulaires intelligents, tableaux de bord internes, automatisations simples, sites vitrines. Pas de grosses plateformes, pas de CRM complexes, pas d'apps mobiles natives.

Prospect :
- Entreprise : ${prospect.company ?? prospect.name}
${prospect.needType.length > 0 ? `- Besoin exprimé : ${prospect.needType.join(", ")}` : ""}
${prospect.companyDescription ? `- Contexte : ${prospect.companyDescription}` : ""}

Utilise web_fetch pour lire leur ${sourceLabel} : ${url}

Après avoir lu le contenu, génère une note terrain. Réponds UNIQUEMENT en JSON :
{
  "company_summary": "2 phrases max : ce que fait cette structure, sa taille estimée, son contexte — déduit du site",
  "detected_sector": "secteur précis (ex: brasserie artisanale, cabinet vétérinaire, association sportive) — déduit du site",
  "website_gap": "1 phrase sur un problème réel observé sur le site (ex: aucun formulaire de contact, pas d'adresse, contenu très pauvre, site inaccessible). null si le site est fonctionnel.",
  "internal_pain": "1-2 phrases : raisonne depuis tes connaissances générales du secteur — PAS depuis le contenu du site. Pour une structure de ce type, quelle tâche interne répétitive est probablement encore gérée à la main ? Ex : suivi des stocks/commandes, gestion des plannings, saisie de devis, relances clients, rapports manuels... Reste dans le scope d'un outil simple."
}`;

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];
  let raw = "{}";

  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 1500,
      tools: [WEB_FETCH_TOOL],
      messages,
    });

    console.log("[analyzeProspect] turn", i, "stop_reason:", response.stop_reason);

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(b => b.type === "text");
      raw = textBlock?.type === "text" ? textBlock.text : "{}";
      break;
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map(b => ({ type: "tool_result", tool_use_id: b.id, content: "" }));
      messages.push({ role: "user", content: toolResults });
    }
  }

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
