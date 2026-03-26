import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triggerN8nAnalysis } from "@/lib/n8n";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const minScore = searchParams.get("minScore");

  const prospects = await prisma.prospect.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(minScore ? { score: { gte: parseInt(minScore) } } : {}),
    },
    include: {
      reminders: { where: { status: "PENDING" }, take: 1, orderBy: { dueAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(prospects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const prospect = await prisma.prospect.create({
    data: {
      name: body.name,
      company: body.company ?? null,
      email: body.email,
      phone: body.phone ?? null,
      linkedinUrl: body.linkedinUrl ?? null,
      websiteUrl: body.websiteUrl ?? null,
      status: body.status ?? "NEW",
      needType: body.needType ?? [],
      estimatedBudget: body.estimatedBudget ?? null,
      source: body.source ?? null,
      nextActionNote: body.nextActionNote ?? null,
      nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
    },
  });

  // Déclenche le workflow n8n si une URL est fournie
  if (prospect.websiteUrl || prospect.linkedinUrl) {
    triggerN8nAnalysis(prospect);
  }

  return NextResponse.json(prospect, { status: 201 });
}
