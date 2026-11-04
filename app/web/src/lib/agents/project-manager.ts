import { prisma } from "@/lib/prisma";
import { MODEL_SONNET } from "@/config";
import type { AgentSpec } from "./types";

export const projectManagerAgent: AgentSpec = {
  name: "project_manager",
  description:
    "Agent Project Manager : projets clients, jalons, tâches, livraisons, deadlines et notes de suivi client.",
  model: MODEL_SONNET,
  system:
    "Tu es l'agent Project Manager de DeepShift. Tu suis l'avancement des projets, jalons, tâches et livraisons, et tu signales les risques de retard. " +
    "Appuie-toi sur les données réelles via tes outils. Réponds en français, concis.",
  tools: [
    {
      def: {
        name: "list_projects",
        description: "Liste les projets avec leur statut, deadline et client. Par défaut les projets actifs.",
        input_schema: { type: "object", properties: { includeClosed: { type: "boolean" } } },
      },
      run: async ({ includeClosed }) =>
        prisma.project.findMany({
          where: includeClosed ? undefined : { status: { in: ["BRIEF", "IN_PROGRESS", "REVIEW", "ON_HOLD"] } },
          orderBy: { deadline: "asc" },
          select: {
            id: true, name: true, status: true, deadline: true, budget: true,
            prospect: { select: { name: true, company: true } },
          },
        }),
    },
    {
      def: {
        name: "get_project",
        description: "Détail d'un projet : jalons, tâches, livraisons, notes client.",
        input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      },
      run: async ({ id }) =>
        prisma.project.findUnique({
          where: { id: String(id) },
          include: {
            milestones: { orderBy: { order: "asc" }, include: { tasks: { orderBy: { order: "asc" } } } },
            deliveries: { orderBy: { createdAt: "desc" }, take: 5 },
            clientNotes: { orderBy: { createdAt: "desc" }, take: 5 },
          },
        }),
    },
    {
      def: {
        name: "upcoming_milestones",
        description: "Jalons non terminés dont l'échéance tombe dans les N prochains jours (retards inclus).",
        input_schema: { type: "object", properties: { days: { type: "number" } } },
      },
      run: async ({ days }) =>
        prisma.milestone.findMany({
          where: {
            status: { in: ["PENDING", "IN_PROGRESS"] },
            dueAt: { lte: new Date(Date.now() + (Number(days) || 14) * 86400000) },
          },
          include: { project: { select: { id: true, name: true } } },
          orderBy: { dueAt: "asc" },
        }),
    },
    {
      def: {
        name: "set_task_done",
        description: "Coche ou décoche une tâche.",
        input_schema: {
          type: "object",
          properties: { taskId: { type: "string" }, done: { type: "boolean" } },
          required: ["taskId", "done"],
        },
      },
      run: async ({ taskId, done }) =>
        prisma.task.update({ where: { id: String(taskId) }, data: { done: Boolean(done) } }),
    },
  ],
};
