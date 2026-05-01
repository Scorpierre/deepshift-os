import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await request.json();
  const { name, description, dueAt } = body;

  if (!name) return NextResponse.json({ error: "name requis." }, { status: 400 });

  const count = await prisma.milestone.count({ where: { projectId } });

  const milestone = await prisma.milestone.create({
    data: {
      projectId,
      name,
      description: description ?? null,
      dueAt: dueAt ? new Date(dueAt) : null,
      order: count,
    },
    include: { tasks: true },
  });

  return NextResponse.json(milestone, { status: 201 });
}
