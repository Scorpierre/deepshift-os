import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const J3 = 3 * 24 * 60 * 60 * 1000;
const J7 = 7 * 24 * 60 * 60 * 1000;

/**
 * Retourne les prospects qui ont besoin d'une relance email.
 * Appelé par n8n chaque matin — n8n se charge de générer + envoyer les emails.
 *
 * Logique :
 * - 1 email SENT, 0 réponse, dernier envoi >= J+3  → relance #1
 * - 2 emails SENT, 0 réponse, dernier envoi >= J+7 → relance #2
 * - 3 emails SENT, 0 réponse, dernier envoi >= J+10 → à passer en LOST (géré par auto-lost)
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-n8n-secret") !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();

  // Récupère tous les prospects actifs avec leurs emails
  const prospects = await prisma.prospect.findMany({
    where: {
      status: { notIn: ["WON", "LOST", "ARCHIVED"] },
    },
    include: {
      emails: { orderBy: { sentAt: "asc" } },
    },
  });

  const needsFollowup1: { prospectId: string; name: string; company: string | null }[] = [];
  const needsFollowup2: { prospectId: string; name: string; company: string | null }[] = [];

  for (const prospect of prospects) {
    const sentEmails = prospect.emails.filter((e) => e.direction === "SENT");
    const hasResponse = prospect.emails.some((e) => e.direction === "RECEIVED");

    if (hasResponse || sentEmails.length === 0) continue;

    const lastSent = sentEmails[sentEmails.length - 1];
    const timeSinceLast = now - new Date(lastSent.sentAt).getTime();

    if (sentEmails.length === 1 && timeSinceLast >= J3) {
      needsFollowup1.push({ prospectId: prospect.id, name: prospect.name, company: prospect.company });
    } else if (sentEmails.length === 2 && timeSinceLast >= J7) {
      needsFollowup2.push({ prospectId: prospect.id, name: prospect.name, company: prospect.company });
    }
  }

  return NextResponse.json({ followup1: needsFollowup1, followup2: needsFollowup2 });
}
