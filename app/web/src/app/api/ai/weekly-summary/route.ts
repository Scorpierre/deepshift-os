import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [prospects, reminders] = await Promise.all([
    prisma.prospect.findMany({
      where: { updatedAt: { gte: oneWeekAgo } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.reminder.findMany({
      where: { status: "PENDING", dueAt: { lte: new Date() } },
      include: { prospect: { select: { name: true, company: true } } },
    }),
  ]);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Génère un résumé hebdomadaire CRM pour DeepShift (auto-entrepreneur IT).

Prospects actifs cette semaine (${prospects.length}) :
${prospects.map((p: { name: string; company: string | null; status: string; score: number | null }) => `- ${p.name}${p.company ? ` (${p.company})` : ""} — statut: ${p.status}, score: ${p.score ?? "N/A"}`).join("\n")}

Relances en retard (${reminders.length}) :
${reminders.map((r: { prospect: { name: string }; note: string; dueAt: Date }) => `- ${r.prospect.name}: ${r.note} (échéance: ${r.dueAt.toLocaleDateString("fr-FR")})`).join("\n")}

Rédige un résumé en français : points clés, opportunités à saisir, actions prioritaires cette semaine.`,
      },
    ],
  });

  const summary = message.content[0].type === "text" ? message.content[0].text : "";
  return NextResponse.json({ summary });
}
