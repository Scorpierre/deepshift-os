const CLIENT_ID = "756590890641-53pss8h6v2e70tcg9bc6c6cshqfhk55r.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";

const SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
].join(" ");

const code = process.argv[2];

if (!code) {
  const url = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent`;
  console.log("\n1. Ouvre ce lien dans ton navigateur :\n");
  console.log(url);
  console.log("\n2. Connecte-toi avec scopierres@gmail.com");
  console.log("3. Copie le code affiché");
  console.log('4. Lance : node get-refresh-token.mjs <LE_CODE>\n');
} else {
  const res = await fetch("https://oauth2.googleapis.com/token", {
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
  const data = await res.json();
  if (data.refresh_token) {
    console.log("\n✅ Nouveau refresh token :\n");
    console.log(data.refresh_token);
    console.log("\nMets à jour GOOGLE_REFRESH_TOKEN dans .env.production\n");
  } else {
    console.log("Erreur :", data);
  }
}
