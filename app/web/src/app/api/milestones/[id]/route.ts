import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  try {
    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.dueAt !== undefined ? { dueAt: body.dueAt ? new Date(body.dueAt) : null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
      },
      include: { tasks: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json(milestone);
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }
    console.error("[PATCH /api/milestones/[id]]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.milestone.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }
    console.error("[DELETE /api/milestones/[id]]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
