import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docs = await prisma.prospectDocument.findMany({
    where: { prospectId: id },
    select: { id: true, filename: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "Fichier requis." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Fichier trop volumineux (max 5 Mo)." }, { status: 413 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Type non supporté. PDF, JPEG, PNG, WEBP uniquement." }, { status: 415 });
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const doc = await prisma.prospectDocument.create({
    data: { prospectId: id, filename: file.name, mimeType: file.type, data: base64 },
    select: { id: true, filename: true, mimeType: true, createdAt: true },
  });

  return NextResponse.json(doc, { status: 201 });
}
