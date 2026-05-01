import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClientNoteType } from "@prisma/client";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await request.json();
  const { content, type } = body;

  if (!content) return NextResponse.json({ error: "content requis." }, { status: 400 });

  const note = await prisma.clientNote.create({
    data: {
      projectId,
      content,
      type: (type as ClientNoteType) ?? "OTHER",
    },
  });

  return NextResponse.json(note, { status: 201 });
}
