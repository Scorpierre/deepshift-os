import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProspectStatus } from "@prisma/client";
import { analyzeProspect } from "@/lib/analyze-prospect";

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

  // 2. Analyser en arrière-plan (fire & forget) — répondre 201 immédiatement
  analyzeProspect(prospect.id).catch((err) =>
    console.error("[POST /api/prospects] analyzeProspect failed:", err)
  );

  return NextResponse.json(prospect, { status: 201 });
}
