import { prisma } from "@/lib/prisma";
import { MODEL_SONNET } from "@/config";
import type { AgentSpec } from "./types";

export const financialAgent: AgentSpec = {
  name: "financial",
  description:
    "Agent Financial : devis, factures, paiements en retard, chiffre d'affaires, charges et abonnements.",
  model: MODEL_SONNET,
  system:
    "Tu es l'agent Financial de DeepShift (micro-entreprise, montants HT). Tu suis devis, factures, encaissements, charges et abonnements. " +
    "Calcule à partir des données réelles de tes outils, jamais de mémoire. Réponds en français, chiffres précis. " +
    "Tu es en lecture seule : tu ne crées ni ne modifies aucun document financier.",
  tools: [
    {
      def: {
        name: "revenue_summary",
        description: "CA encaissé (factures payées) sur une période, et encours (en attente / en retard).",
        input_schema: {
          type: "object",
          properties: { from: { type: "string", description: "ISO date, défaut: début du mois" }, to: { type: "string" } },
        },
      },
      run: async ({ from, to }) => {
        const now = new Date();
        const start = from ? new Date(String(from)) : new Date(now.getFullYear(), now.getMonth(), 1);
        const end = to ? new Date(String(to)) : now;
        const [paid, pending, overdue] = await Promise.all([
          prisma.invoice.aggregate({ where: { status: "PAID", paidAt: { gte: start, lte: end } }, _sum: { totalHT: true }, _count: true }),
          prisma.invoice.aggregate({ where: { status: "PENDING" }, _sum: { totalHT: true }, _count: true }),
          prisma.invoice.aggregate({ where: { status: "OVERDUE" }, _sum: { totalHT: true }, _count: true }),
        ]);
        return { period: { start, end }, paid, pending, overdue };
      },
    },
    {
      def: {
        name: "list_invoices",
        description: "Liste les factures, filtrables par statut.",
        input_schema: {
          type: "object",
          properties: { status: { type: "string", enum: ["PENDING", "PAID", "OVERDUE", "CANCELLED"] } },
        },
      },
      run: async ({ status }) =>
        prisma.invoice.findMany({
          where: status ? { status: status as never } : undefined,
          orderBy: { issuedAt: "desc" },
          take: 30,
          select: {
            id: true, number: true, title: true, totalHT: true, status: true, issuedAt: true, dueAt: true, paidAt: true,
            prospect: { select: { name: true, company: true } },
          },
        }),
    },
    {
      def: {
        name: "list_quotes",
        description: "Liste les devis, filtrables par statut.",
        input_schema: {
          type: "object",
          properties: { status: { type: "string", enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] } },
        },
      },
      run: async ({ status }) =>
        prisma.quote.findMany({
          where: status ? { status: status as never } : undefined,
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true, number: true, title: true, totalHT: true, status: true, sentAt: true, validUntil: true,
            prospect: { select: { name: true, company: true } },
          },
        }),
    },
    {
      def: {
        name: "expenses_summary",
        description: "Charges actives : abonnements (avec renouvellements) et dépenses ponctuelles récentes.",
        input_schema: { type: "object", properties: {} },
      },
      run: async () => {
        const [subscriptions, recent] = await Promise.all([
          prisma.expense.findMany({ where: { type: "SUBSCRIPTION", isActive: true }, orderBy: { renewsAt: "asc" } }),
          prisma.expense.findMany({ where: { type: "ONE_TIME" }, orderBy: { date: "desc" }, take: 15 }),
        ]);
        return { subscriptions, recent };
      },
    },
  ],
};
