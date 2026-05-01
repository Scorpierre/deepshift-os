import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

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
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.milestone.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
