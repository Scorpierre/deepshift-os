import { SCRAPE_TIMEOUT_MS } from "@/config";

const BLOCKED_HOSTNAMES = /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/;

/** Vérifie que l'URL est externe et utilise HTTP/HTTPS */
export function isSafeUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (BLOCKED_HOSTNAMES.test(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Scrappe une URL via Jina Reader (r.jina.ai) qui rend le JS et retourne du Markdown propre.
 * Retourne null si inaccessible ou bloquée.
 */
export async function scrapeUrl(url: string): Promise<string | null> {
  if (!isSafeUrl(url)) return null;

  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const headers: Record<string, string> = {
      "Accept": "text/markdown",
      "X-Timeout": String(Math.floor(SCRAPE_TIMEOUT_MS / 1000)),
    };
    if (process.env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), SCRAPE_TIMEOUT_MS + 5000);
    const res = await fetch(jinaUrl, { signal: ctrl.signal, headers });
    clearTimeout(t);

    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 6000) || null;
  } catch {
    return null;
  }
}
