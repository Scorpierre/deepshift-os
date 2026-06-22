import { extractText } from "@/lib/html";
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

/** Scrappe une URL externe et retourne le texte lisible, ou null si inaccessible/bloquée */
export async function scrapeUrl(url: string): Promise<string | null> {
  if (!isSafeUrl(url)) return null;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), SCRAPE_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
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
