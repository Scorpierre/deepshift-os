/**
 * Script one-shot pour obtenir le Gmail refresh token.
 * Usage : node scripts/get-gmail-token.mjs
 */

import { createServer } from "http";
import { createInterface } from "readline";

const CLIENT_ID = "756590890641-53pss8h6v2e70tcg9bc6c6cshqfhk55r.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "http://localhost:9999/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });

console.log("\n→ Ouvre cette URL dans ton navigateur :\n");
console.log(authUrl);
console.log("\nEn attente du callback sur http://localhost:9999...\n");

// Lance un serveur local pour intercepter le code
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:9999");
  const code = url.searchParams.get("code");

  if (!code) {
    res.end("Pas de code reçu.");
    return;
  }

  res.end("<h2>Autorisation reçue ✓ Tu peux fermer cet onglet.</h2>");
  server.close();

  // Échange le code contre les tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (tokens.error) {
    console.error("Erreur :", tokens);
    return;
  }

  console.log("\n✅ Ajoute ces variables dans ton .env.local ET .env.production :\n");
  console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
  console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`GMAIL_FROM=ton.email@gmail.com`);
  console.log("\n(Remplace ton.email@gmail.com par ton adresse Gmail)");
});

server.listen(9999);
