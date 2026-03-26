import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 6000);
}

async function scrape(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return extractText(await res.text());
  } catch {
    return null;
  }
}

export async function analyzeProspect(prospectId: string) {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return;

  const url = prospect.websiteUrl ?? prospect.linkedinUrl;
  if (!url) return;

  const pageContent = await scrape(url);
  if (!pageContent) return;

  const isFacebook = url.includes("facebook.com") || url.includes("fb.com");
  const sourceLabel = isFacebook ? "page Facebook" : "site web";

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001", // modèle rapide pour l'analyse background
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `Analyse cette ${sourceLabel} d'une entreprise prospect pour DeepShift (web apps sur mesure, consulting digital).

Entreprise : ${prospect.company ?? prospect.name}
Contenu de leur ${sourceLabel} :
---
${pageContent}
---

Réponds UNIQUEMENT en JSON :
{
  "summary": "résumé de l'entreprise en 2-3 phrases : secteur, taille estimée, maturité digitale",
  "opportunities": ["opportunité 1 pour DeepShift", "opportunité 2"],
  "digital_maturity": "faible | moyenne | élevée",
  "has_website": true
}`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  let parsed: {
    summary?: string;
    opportunities?: string[];
    digital_maturity?: string;
    has_website?: boolean;
  } = {};
  try { parsed = JSON.parse(match?.[0] ?? "{}"); } catch { /* ignore */ }

  if (!parsed.summary) return;

  const summaryText = [
    parsed.summary,
    parsed.opportunities?.length
      ? `Opportunités : ${parsed.opportunities.join(" · ")}`
      : null,
    parsed.digital_maturity
      ? `Maturité digitale : ${parsed.digital_maturity}`
      : null,
  ].filter(Boolean).join("\n");

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { aiSummary: summaryText },
  });
}
