import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: milestoneId } = await params;
  const body = await request.json();
  const { title } = body;

  if (!title) return NextResponse.json({ error: "title requis." }, { status: 400 });

  const count = await prisma.task.count({ where: { milestoneId } });

  const task = await prisma.task.create({
    data: { milestoneId, title, order: count },
  });

  return NextResponse.json(task, { status: 201 });
}
