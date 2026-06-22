import { NextRequest, NextResponse } from "next/server";
import { analyzeProspect } from "@/lib/analyze-prospect";

export async function POST(request: NextRequest) {
  const { prospectId } = await request.json();
  if (!prospectId) return NextResponse.json({ error: "prospectId required" }, { status: 400 });

  await analyzeProspect(prospectId);

  return NextResponse.json({ success: true });
}
