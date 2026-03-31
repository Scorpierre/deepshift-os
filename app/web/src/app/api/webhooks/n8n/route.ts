import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Appelé par n8n à la fin du workflow d'analyse.
 * Body attendu : { prospectId, aiSummary, aiScoreReason?, score? }
 */
export async function POST(request: NextRequest) {
  // Vérification du secret partagé
  const secret = request.headers.get("x-n8n-secret");
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { prospectId, aiSummary, aiScoreReason, score } = body;

  if (!prospectId || !aiSummary) {
    return NextResponse.json({ error: "prospectId and aiSummary required" }, { status: 400 });
  }

  const parsedScore = score !== undefined && score !== null ? parseInt(score) : undefined;
  if (parsedScore !== undefined && (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 10)) {
    return NextResponse.json({ error: "score must be 0-10" }, { status: 400 });
  }

  const updated = await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      aiSummary,
      ...(aiScoreReason && { aiScoreReason }),
      ...(parsedScore !== undefined && { score: parsedScore }),
    },
  });

  return NextResponse.json({ success: true, id: updated.id });
}
