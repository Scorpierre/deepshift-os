import { prisma } from "@/lib/prisma";
import { MODEL_SONNET } from "@/config";
import type { AgentSpec } from "./types";

export const salesAgent: AgentSpec = {
  name: "sales",
  description:
    "Agent Sales : CRM et prospection. Pipeline, prospects, scoring, historique d'emails, relances et rappels commerciaux.",
  model: MODEL_SONNET,
  system:
    "Tu es l'agent Sales de DeepShift (auto-entreprise IT de Pierre). Tu gères le pipeline commercial : prospects, scoring, emails, relances. " +
    "Utilise tes outils pour obtenir des données réelles, n'invente rien. Réponds en français, de façon concise et actionnable. " +
    "Tu ne peux pas envoyer d'email : tu peux seulement proposer des brouillons.",
  tools: [
    {
      def: {
        name: "list_prospects",
        description: "Liste les prospects, filtrables par statut. Triés par dernière mise à jour.",
        input_schema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["NEW", "SCORED", "VIP", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST", "ARCHIVED"],
            },
            limit: { type: "number" },
          },
        },
      },
      run: async ({ status, limit }) =>
        prisma.prospect.findMany({
          where: status ? { status: status as never } : undefined,
          orderBy: { updatedAt: "desc" },
          take: Math.min(Number(limit) || 20, 50),
          select: {
            id: true, name: true, company: true, status: true, score: true,
            estimatedBudget: true, lastContactedAt: true, nextActionAt: true, nextActionNote: true,
          },
        }),
    },
    {
      def: {
        name: "get_prospect",
        description: "Fiche détaillée d'un prospect (résumé IA, derniers emails, notes, rappels).",
        input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      },
      run: async ({ id }) =>
        prisma.prospect.findUnique({
          where: { id: String(id) },
          include: {
            emails: { orderBy: { createdAt: "desc" }, take: 5 },
            notes: { orderBy: { createdAt: "desc" }, take: 5 },
            reminders: { where: { status: "PENDING" } },
          },
        }),
    },
    {
      def: {
        name: "pending_reminders",
        description: "Rappels commerciaux en attente et échus (relances à faire).",
        input_schema: { type: "object", properties: {} },
      },
      run: async () =>
        prisma.reminder.findMany({
          where: { status: "PENDING", dueAt: { lte: new Date() } },
          include: { prospect: { select: { id: true, name: true, company: true } } },
          orderBy: { dueAt: "asc" },
        }),
    },
    {
      def: {
        name: "add_prospect_note",
        description: "Ajoute une note à un prospect.",
        input_schema: {
          type: "object",
          properties: { prospectId: { type: "string" }, content: { type: "string" } },
          required: ["prospectId", "content"],
        },
      },
      run: async ({ prospectId, content }) =>
        prisma.note.create({ data: { prospectId: String(prospectId), content: String(content) } }),
    },
  ],
};
