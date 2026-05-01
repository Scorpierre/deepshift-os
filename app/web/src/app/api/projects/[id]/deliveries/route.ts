import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await request.json();
  const { title, description, deliveredAt } = body;

  if (!title) return NextResponse.json({ error: "title requis." }, { status: 400 });

  const delivery = await prisma.delivery.create({
    data: {
      projectId,
      title,
      description: description ?? null,
      deliveredAt: deliveredAt ? new Date(deliveredAt) : new Date(),
    },
  });

  return NextResponse.json(delivery, { status: 201 });
}
