import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const VALID_SOURCES = ["manual", "email", "call", "meeting", "other"] as const;

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { content, source } = await request.json();

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Le contenu de la note est requis." }, { status: 400 });
  }

  const validSource = VALID_SOURCES.includes(source) ? source : "manual";

  try {
    const note = await prisma.note.create({
      data: { prospectId: id, content: content.trim(), source: validSource },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025" || code === "P2003") {
      return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
    }
    console.error("[POST /api/prospects/[id]/notes]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
