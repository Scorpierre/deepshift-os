import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as ProjectStatus | null;
  const prospectId = searchParams.get("prospectId");

  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(prospectId ? { prospectId } : {}),
    },
    include: {
      prospect: { select: { id: true, name: true, company: true } },
      milestones: {
        include: { tasks: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { prospectId, name, description, deadline, startDate, budget } = body;

  if (!prospectId || !name) {
    return NextResponse.json({ error: "prospectId et name requis." }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      prospectId,
      name,
      description: description ?? null,
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      budget: budget ?? null,
    },
    include: {
      prospect: { select: { id: true, name: true, company: true } },
      milestones: { include: { tasks: true } },
      deliveries: true,
      clientNotes: true,
    },
  });

  // Génération IA des étapes en arrière-plan (fire & forget)
  generateMilestonesAsync(project.id);

  return NextResponse.json(project, { status: 201 });
}

async function generateMilestonesAsync(projectId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    await fetch(`${baseUrl}/api/ai/generate-milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, clearExisting: false }),
    });
  } catch (err) {
    console.error("[generateMilestonesAsync] error:", err);
  }
}
