import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeProspect } from "@/lib/analyze-prospect";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { prospectId } = await request.json();
  if (!prospectId) return NextResponse.json({ error: "prospectId required" }, { status: 400 });

  await analyzeProspect(prospectId);

  const updated = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!updated) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  return NextResponse.json(updated);
}
