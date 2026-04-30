import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { sendEmail, applyLabel } from "@/lib/gmail";

/**
 * Appelé par n8n chaque mardi/mercredi/jeudi à 9h (heure de Paris).
 * Prend le prochain prospect SCORED (File 9h), génère un email avec Claude et l'envoie.
 * 1 prospect traité par déclenchement.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-n8n-secret") !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prend le plus ancien prospect SCORED sans email envoyé
  const prospect = await prisma.prospect.findFirst({
    where: {
      status: "SCORED",
      emails: { none: { direction: "SENT" } },
    },
    orderBy: { createdAt: "asc" },
    include: { emails: true },
  });

  if (!prospect) {
    return NextResponse.json({ sent: false, reason: "Aucun prospect SCORED en attente" });
  }

  // Génère l'email avec Claude (réutilise aiSummary déjà en base)
  const url = prospect.websiteUrl ?? prospect.linkedinUrl ?? null;
  const isFacebook = url ? (url.includes("facebook.com") || url.includes("fb.com")) : false;
  const hasOnlinePresence = !!url;

  const companyContext = prospect.aiSummary
    ? `Analyse commerciale du prospect (déjà effectuée) :\n---\n${prospect.aiSummary}\n---`
    : prospect.companyDescription
    ? `Description de l'entreprise :\n---\n${prospect.companyDescription}\n---`
    : "";

  const opportunityHint = isFacebook
    ? `IMPORTANT : ils n'ont qu'une page Facebook — opportunité claire pour proposer un vrai site web. Mentionne les limites d'une page FB et la valeur d'un site sur mesure.`
    : hasOnlinePresence && companyContext
    ? `Appuie-toi sur l'analyse commerciale pour identifier 1-2 points d'amélioration concrets à mentionner naturellement.`
    : "";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `Tu es Pierre Connes, auto-entrepreneur IT (DeepShift) spécialisé en web apps sur mesure et consulting digital. Rédige un email de prospection hyper-personnalisé.

Prospect :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin pressenti : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}

${companyContext}

${opportunityHint}

Règles pour l'email :
- Ton : professionnel et direct, comme un mail entre deux pros — ni trop formel ni familier
- Pas de "J'espère que ce message vous trouve en bonne santé", pas de superlatifs, pas de jargon marketing
- Commence par une observation concrète sur leur activité (1 phrase)
- Identifie clairement un problème ou une opportunité, propose brièvement ce que tu peux apporter
- 3 paragraphes max, phrases courtes
- Termine par une question simple et directe
- Signature : "Pierre — DeepShift"

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet court et accrocheur",
  "body": "Corps de l'email complet"
}`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let parsed: { subject?: string; body?: string } = {};
  try { parsed = JSON.parse(jsonMatch?.[0] ?? "{}"); } catch { /* fallback */ }

  if (!parsed.subject || !parsed.body) {
    return NextResponse.json({ sent: false, reason: "Échec génération email Claude" }, { status: 500 });
  }

  // Envoie l'email
  const { gmailId } = await sendEmail({ to: prospect.email, subject: parsed.subject, body: parsed.body });
  await applyLabel(gmailId, "deepshift-prospect");

  // Sauvegarde en base
  await prisma.email.create({
    data: {
      prospectId: prospect.id,
      direction: "SENT",
      subject: parsed.subject,
      body: parsed.body,
      sentAt: new Date(),
      gmailId,
    },
  });

  // Passe en CONTACTED
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { status: "CONTACTED", lastContactedAt: new Date() },
  });

  return NextResponse.json({ sent: true, prospectId: prospect.id, name: prospect.name });
}
