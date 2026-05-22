const CLIENT_ID = "756590890641-53pss8h6v2e70tcg9bc6c6cshqfhk55r.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//03KEF0gWR8q4fCgYIARAAGAMSNwF-L9IrCk4LugxyTf_bnZkMJ6XMTGyvLlhO4jwRtUk9OX8Lq8fhlqwl3CNNP-Dtak9rYzlyBjw";

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: "refresh_token" }),
});
const { access_token } = await tokenRes.json();

const msgsRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label:deepshift-prospect&maxResults=10", {
  headers: { Authorization: `Bearer ${access_token}` },
});
const { messages } = await msgsRes.json();

for (const m of messages ?? []) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const data = await res.json();
  const headers = data.payload?.headers ?? [];
  const from = headers.find(h => h.name === "From")?.value ?? "";
  const subject = headers.find(h => h.name === "Subject")?.value ?? "";
  console.log(`ID: ${m.id} | From: ${from} | Subject: ${subject}`);
}
