// Génère un GOOGLE_REFRESH_TOKEN via redirection locale (le flux "oob" n'existe plus).
// Usage : node --env-file=app/web/.env.local get-gmail-token.mjs
import http from "node:http";
import { exec } from "node:child_process";

const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) { console.error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants."); process.exit(1); }

const PORT = 53682;
const redirect = `http://localhost:${PORT}`;
const scope = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
].join(" ");

const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: id, redirect_uri: redirect, response_type: "code", scope,
  access_type: "offline", prompt: "consent", login_hint: process.env.GMAIL_FROM ?? "",
});

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get("code");
  if (!code) { res.end("En attente…"); return; }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const data = await r.json();
  res.end(data.refresh_token ? "OK, token reçu — reviens au terminal." : "Erreur, regarde le terminal.");
  if (data.refresh_token) console.log("\nGOOGLE_REFRESH_TOKEN=\"" + data.refresh_token + "\"\n");
  else console.error("Erreur :", data);
  server.close();
});

server.listen(PORT, () => {
  console.log(`Connecte-toi avec ${process.env.GMAIL_FROM}. Si le navigateur ne s'ouvre pas :\n${url}\n`);
  exec(`open "${url}"`);
});
