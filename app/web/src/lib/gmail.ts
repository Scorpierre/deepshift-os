/**
 * Client Gmail minimal — OAuth2 avec refresh token.
 * Pas de dépendance googleapis, juste fetch.
 */

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Gmail token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

/** Encode en base64url (requis par l'API Gmail) */
function toBase64Url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Supprime les CRLF d'un header pour éviter l'injection */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Construit un email RFC 2822 */
function buildRawEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): string {
  const from = process.env.GMAIL_FROM!;
  const senderName = sanitizeHeader(process.env.GMAIL_FROM_NAME ?? "Pierre Connes");
  const mime = [
    `From: ${senderName} <${sanitizeHeader(from)}>`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join("\r\n");

  return toBase64Url(mime);
}

/** Extrait l'adresse email depuis un header "From" ("Nom Prénom <email@domain.com>") */
export function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

/** Extrait le texte brut d'un payload Gmail (MIME) */
function extractBody(payload: Record<string, unknown>): string {
  if (!payload) return "";
  const body = payload.body as { data?: string } | undefined;
  if (payload.mimeType === "text/plain" && body?.data) {
    return Buffer.from(body.data, "base64").toString("utf-8");
  }
  const parts = payload.parts as Record<string, unknown>[] | undefined;
  if (parts) {
    for (const part of parts) {
      const partBody = part.body as { data?: string } | undefined;
      if (part.mimeType === "text/plain" && partBody?.data) {
        return Buffer.from(partBody.data, "base64").toString("utf-8");
      }
    }
    for (const part of parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}

/** Retourne les gmailIds des messages non lus dans la boîte de réception */
export async function listUnreadEmailIds(): Promise<string[]> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+in:inbox&maxResults=50",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return (data.messages ?? []).map((m: { id: string }) => m.id);
}

/** Récupère le contenu complet d'un message Gmail */
export async function getEmailMessage(gmailId: string): Promise<{
  gmailId: string;
  from: string;
  subject: string;
  body: string;
}> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const headers = (data.payload?.headers ?? []) as { name: string; value: string }[];
  const from = headers.find((h) => h.name === "From")?.value ?? "";
  const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
  const body = extractBody(data.payload ?? {});
  return { gmailId, from, subject, body };
}

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ gmailId: string }> {
  const accessToken = await getAccessToken();
  const raw = buildRawEmail({ to, subject, body });

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail send error: ${JSON.stringify(data)}`);

  return { gmailId: data.id };
}
