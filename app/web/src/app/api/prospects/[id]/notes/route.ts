import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { content, source } = await request.json();

  const note = await prisma.note.create({
    data: { prospectId: id, content, source: source ?? "manual" },
  });

  return NextResponse.json(note, { status: 201 });
}
