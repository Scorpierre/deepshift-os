import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const delivery = await prisma.delivery.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.clientOk !== undefined ? { clientOk: body.clientOk } : {}),
      ...(body.feedback !== undefined ? { feedback: body.feedback } : {}),
    },
  });

  return NextResponse.json(delivery);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.delivery.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
