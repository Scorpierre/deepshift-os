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

/** Retourne l'ID du label Gmail par son nom, null si introuvable */
async function getLabelId(name: string, accessToken: string): Promise<string | null> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const label = (data.labels ?? []).find((l: { name: string }) => l.name === name);
  return label?.id ?? null;
}

/** Applique un label Gmail à un message */
export async function applyLabel(gmailId: string, labelName: string): Promise<void> {
  const accessToken = await getAccessToken();
  const labelId = await getLabelId(labelName, accessToken);
  if (!labelId) return;
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
}

/** Retourne les gmailIds des emails reçus dans les 2 derniers jours */
export async function listUnreadEmailIds(): Promise<string[]> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox+-from:me+newer_than:2d&maxResults=50",
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

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  data: string; // base64 standard (pas base64url)
};

/** Extrait récursivement les métadonnées des pièces jointes d'un payload Gmail */
function extractAttachmentMeta(
  payload: Record<string, unknown>,
  messageId: string
): { filename: string; mimeType: string; attachmentId: string; messageId: string }[] {
  const results: { filename: string; mimeType: string; attachmentId: string; messageId: string }[] = [];

  const body = payload.body as { attachmentId?: string; size?: number } | undefined;
  const filename = payload.filename as string | undefined;
  const mimeType = payload.mimeType as string | undefined;

  if (body?.attachmentId && filename && mimeType) {
    results.push({ filename, mimeType, attachmentId: body.attachmentId, messageId });
  }

  const parts = payload.parts as Record<string, unknown>[] | undefined;
  if (parts) {
    for (const part of parts) {
      results.push(...extractAttachmentMeta(part, messageId));
    }
  }

  return results;
}

/**
 * Récupère les pièces jointes PDF et images d'un email Gmail.
 * Limite : 5 Mo par fichier. Ignore silencieusement les erreurs.
 */
export async function getEmailAttachments(messageId: string): Promise<EmailAttachment[]> {
  const accessToken = await getAccessToken();

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();

  const supported = extractAttachmentMeta(data.payload ?? {}, messageId).filter(
    (a) => a.mimeType === "application/pdf" || a.mimeType.startsWith("image/")
  );

  const attachments: EmailAttachment[] = [];

  for (const att of supported) {
    try {
      const attRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${att.messageId}/attachments/${att.attachmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const attData = await attRes.json();
      if (!attData.data) continue;

      // Limite 5 Mo (base64url ~6.7M chars)
      if (attData.data.length > 6_800_000) {
        console.warn(`[getEmailAttachments] ${att.filename} trop volumineux, ignoré`);
        continue;
      }

      // base64url → base64 standard
      const base64 = (attData.data as string).replace(/-/g, "+").replace(/_/g, "/");
      attachments.push({ filename: att.filename, mimeType: att.mimeType, data: base64 });
    } catch (err) {
      console.error(`[getEmailAttachments] erreur pour ${att.filename}:`, err);
    }
  }

  return attachments;
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
