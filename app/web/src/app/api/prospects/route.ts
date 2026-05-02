import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProspectStatus } from "@prisma/client";
import { anthropic } from "@/lib/anthropic";
import { triggerN8nAnalysis } from "@/lib/n8n";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_HAIKU } from "@/config";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status");
  const minScore = searchParams.get("minScore");

  // Supporte status=LOST,ARCHIVED (multi-valeurs séparées par virgule)
  const statuses = statusParam ? statusParam.split(",").map((s) => s.trim() as ProspectStatus) : null;

  const prospects = await prisma.prospect.findMany({
    where: {
      ...(statuses && statuses.length === 1 ? { status: statuses[0] } : {}),
      ...(statuses && statuses.length > 1 ? { status: { in: statuses } } : {}),
      ...(minScore ? { score: { gte: parseInt(minScore) } } : {}),
    },
    include: {
      reminders: { where: { status: "PENDING" }, take: 1, orderBy: { dueAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(prospects);
}

type ProspectCreateBody = {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  needType?: string[];
  estimatedBudget?: number;
  source?: string;
  nextActionNote?: string;
  nextActionAt?: string;
  companyDescription?: string;
};

export async function POST(request: NextRequest) {
  let body: ProspectCreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 1. Créer le prospect avec statut SCORING
  let prospect;
  try {
    prospect = await prisma.prospect.create({
      data: {
        name: body.name,
        company: body.company ?? null,
        email: body.email,
        phone: body.phone ?? null,
        linkedinUrl: body.linkedinUrl ?? null,
        websiteUrl: body.websiteUrl ?? null,
        status: "SCORING" as ProspectStatus,
        needType: body.needType ?? [],
        estimatedBudget: body.estimatedBudget ?? null,
        source: body.source ?? null,
        nextActionNote: body.nextActionNote ?? null,
        nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
        companyDescription: body.companyDescription ?? null,
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Un prospect avec cet email existe déjà." }, { status: 409 });
    }
    console.error("[POST /api/prospects] create error:", err);
    return NextResponse.json({ error: "Erreur lors de la création du prospect." }, { status: 500 });
  }

  // 2. Scorer en arrière-plan (fire & forget) — répondre 201 immédiatement
  scoreProspectAsync(prospect, body.companyDescription ?? null);

  return NextResponse.json(prospect, { status: 201 });
}

async function scoreProspectAsync(
  prospect: { id: string; name: string; company: string | null; needType: string[]; source: string | null; estimatedBudget: number | null; websiteUrl: string | null; linkedinUrl: string | null },
  companyDescription: string | null
) {
  try {
    const message = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Tu es un expert en développement commercial. Tu évalues le potentiel de conclure un contrat avec ce prospect pour Pierre Connes (DeepShift), freelance IT spécialisé en sites web, web apps sur mesure et consulting digital pour PME/TPE/indépendants.

Prospect :
- Nom : ${prospect.name}
- Entreprise : ${prospect.company ?? "inconnue"}
- Besoin exprimé : ${prospect.needType.join(", ") || "non précisé"}
- Source : ${prospect.source ?? "inconnue"}
- Budget estimé : ${prospect.estimatedBudget ? `${prospect.estimatedBudget} €` : "inconnu"}
${companyDescription ? `- Description / contexte : ${companyDescription}` : ""}

Donne un score de 1 à 10 représentant la probabilité de conclure un contrat :
- 8-10 : Très fort potentiel → tag VIP, traitement personnalisé
- 4-7 : Bon prospect → email automatique le matin
- 1-3 : Faible potentiel → archiver

Réponds UNIQUEMENT en JSON :
{"score":7,"reason":"PME avec besoin clair, budget probable.","tags":["site-vitrine","pme"],"recommended_action":"Envoyer email de présentation"}`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = parseAiJson<{ score?: number; reason?: string; tags?: string[]; recommended_action?: string }>(raw, "score-async") ?? {};

    const score = typeof parsed.score === "number" ? Math.min(10, Math.max(1, Math.round(parsed.score))) : null;
    let newStatus: ProspectStatus;
    if (score !== null && score >= 8) {
      newStatus = "VIP" as ProspectStatus;
    } else if (score !== null && score <= 3) {
      newStatus = "ARCHIVED" as ProspectStatus;
    } else {
      newStatus = "SCORED" as ProspectStatus;
    }

    const updated = await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        status: newStatus,
        score,
        aiScoreReason: parsed.reason ?? null,
        aiTags: parsed.tags ?? [],
        aiRecommendedAction: parsed.recommended_action ?? null,
      },
    });

    if (updated.websiteUrl || updated.linkedinUrl) {
      triggerN8nAnalysis(updated);
    }
  } catch (err) {
    console.error("[scoreProspectAsync] scoring error for prospect", prospect.id, err);
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { status: "SCORED" as ProspectStatus },
    }).catch((updateErr) => {
      console.error("[scoreProspectAsync] fallback status update failed for prospect", prospect.id, updateErr);
    });
  }
}
