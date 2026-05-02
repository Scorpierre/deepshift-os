import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { MODEL_HAIKU } from "@/config";

type ProspectRow = { name: string; company: string | null; status: string; score: number | null };
type ReminderRow = { prospect: { name: string }; note: string; dueAt: Date };
type ProjectRow = { name: string; status: string; deadline: Date | null };
type MilestoneRow = { name: string; dueAt: Date | null; project: { name: string } };

export async function POST() {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    prospects,
    reminders,
    caMonth,
    pendingInvoices,
    overdueCount,
    activeProjects,
    upcomingMilestones,
    subsTotal,
  ] = await Promise.all([
    prisma.prospect.findMany({
      where: { updatedAt: { gte: oneWeekAgo } },
      orderBy: { updatedAt: "desc" },
      select: { name: true, company: true, status: true, score: true },
    }),
    prisma.reminder.findMany({
      where: { status: "PENDING", dueAt: { lte: now } },
      include: { prospect: { select: { name: true } } },
    }),
    prisma.invoice.aggregate({
      where: { status: "PAID", paidAt: { gte: startOfMonth } },
      _sum: { totalHT: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["PENDING", "OVERDUE"] } },
      _sum: { totalHT: true },
      _count: true,
    }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.project.findMany({
      where: { status: { in: ["BRIEF", "IN_PROGRESS", "REVIEW"] } },
      select: { name: true, status: true, deadline: true },
    }),
    prisma.milestone.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueAt: { lte: oneWeekFromNow },
      },
      include: { project: { select: { name: true } } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.expense.aggregate({
      where: { type: "SUBSCRIPTION", isActive: true, billingCycle: "MONTHLY" },
      _sum: { amount: true },
    }),
  ]);

  const monthlyBurn = subsTotal._sum.amount ?? 0;

  const prospectLines = (prospects as ProspectRow[])
    .map((p) => `- ${p.name}${p.company ? ` (${p.company})` : ""} — ${p.status}, score: ${p.score ?? "N/A"}`)
    .join("\n") || "Aucun";

  const reminderLines = (reminders as ReminderRow[])
    .map((r) => `- ${r.prospect.name}: ${r.note} (échéance: ${r.dueAt.toLocaleDateString("fr-FR")})`)
    .join("\n") || "Aucune";

  const projectLines = (activeProjects as ProjectRow[])
    .map((p) => `- ${p.name} — ${p.status}${p.deadline ? `, deadline: ${new Date(p.deadline).toLocaleDateString("fr-FR")}` : ""}`)
    .join("\n") || "Aucun";

  const milestoneLines = (upcomingMilestones as MilestoneRow[])
    .map((m) => `- [${m.project.name}] ${m.name}${m.dueAt ? ` — ${new Date(m.dueAt).toLocaleDateString("fr-FR")}` : ""}`)
    .join("\n") || "Aucun";

  const prompt = [
    "Génère un résumé hebdomadaire complet pour DeepShift (auto-entrepreneur IT solo).",
    "",
    "## CRM — Activité cette semaine",
    `Prospects actifs (${prospects.length}) :`,
    prospectLines,
    "",
    `Relances en retard (${reminders.length}) :`,
    reminderLines,
    "",
    "## Finance",
    `- CA encaissé ce mois : ${(caMonth._sum.totalHT ?? 0).toFixed(0)} €`,
    `- Factures en attente : ${pendingInvoices._count} (${(pendingInvoices._sum.totalHT ?? 0).toFixed(0)} €)`,
    `- Factures en retard de paiement : ${overdueCount}`,
    `- Charges abonnements mensuels : ~${monthlyBurn.toFixed(0)} €/mois`,
    "",
    `## Projets en cours (${activeProjects.length})`,
    projectLines,
    "",
    "Jalons à venir cette semaine :",
    milestoneLines,
    "",
    "---",
    "Rédige un résumé exécutif en français structuré en 3 parties : **Bilan de la semaine**, **Points d'attention**, **3-5 actions prioritaires pour cette semaine**. Sois concis, actionnable, sans bullshit. Utilise des bullet points.",
  ].join("\n");

  const message = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const summary = message.content[0].type === "text" ? message.content[0].text : "";
  return NextResponse.json({ summary });
}
