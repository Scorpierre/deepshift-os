import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const J10 = 10 * 24 * 60 * 60 * 1000;

/**
 * Passe en LOST les prospects qui n'ont pas répondu après 3 emails (original + 2 relances) + 10 jours.
 * Condition : 3+ emails SENT, 0 email RECEIVED, dernier envoi >= J+10.
 * Appelé par n8n chaque matin (header x-n8n-secret requis).
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-n8n-secret") !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();

  const prospects = await prisma.prospect.findMany({
    where: {
      status: { notIn: ["WON", "LOST", "ARCHIVED"] },
    },
    include: {
      emails: { orderBy: { sentAt: "asc" } },
    },
  });

  const toLost: string[] = [];

  for (const prospect of prospects) {
    const sentEmails = prospect.emails.filter((e) => e.direction === "SENT");
    const hasResponse = prospect.emails.some((e) => e.direction === "RECEIVED");

    if (hasResponse || sentEmails.length < 3) continue;

    const lastSent = sentEmails[sentEmails.length - 1];
    const timeSinceLast = now - new Date(lastSent.sentAt).getTime();

    if (timeSinceLast >= J10) {
      toLost.push(prospect.id);
    }
  }

  if (toLost.length === 0) return NextResponse.json({ updated: 0 });

  const result = await prisma.prospect.updateMany({
    where: { id: { in: toLost } },
    data: { status: "LOST" },
  });

  return NextResponse.json({ updated: result.count });
}
