import { MODEL_SONNET } from "@/config";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent, listCalendarEvents } from "@/lib/google-calendar";
import type { AgentSpec } from "./types";

export const secretaryAgent: AgentSpec = {
  name: "secretary",
  description:
    "Agent Secrétaire : agenda Google Calendar, rendez-vous, emails reçus à traiter, rédaction de brouillons d'emails, organisation de la journée.",
  model: MODEL_SONNET,
  system:
    "Tu es l'agent Secrétaire de Pierre (DeepShift). Tu gères l'agenda, les rendez-vous, et tu rédiges des brouillons d'emails professionnels en français. " +
    "Tu ne peux pas envoyer d'email : tu présentes le brouillon (destinataire, objet, corps) pour validation. Fuseau horaire: Europe/Paris.",
  tools: [
    {
      def: {
        name: "list_calendar_events",
        description: "Événements Google Calendar entre deux dates ISO 8601.",
        input_schema: {
          type: "object",
          properties: { timeMin: { type: "string" }, timeMax: { type: "string" } },
          required: ["timeMin", "timeMax"],
        },
      },
      run: async ({ timeMin, timeMax }) => {
        const events = await listCalendarEvents(String(timeMin), String(timeMax));
        return events.map((e) => ({ id: e.id, summary: e.summary, start: e.start, end: e.end, location: e.location }));
      },
    },
    {
      def: {
        name: "create_calendar_event",
        description: "Crée un événement dans Google Calendar (dateTime ISO 8601 avec fuseau).",
        input_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            description: { type: "string" },
            startDateTime: { type: "string" },
            endDateTime: { type: "string" },
            attendeeEmail: { type: "string" },
          },
          required: ["summary", "startDateTime", "endDateTime"],
        },
      },
      run: async (i) => {
        const e = await createCalendarEvent({
          summary: String(i.summary),
          description: i.description ? String(i.description) : undefined,
          start: { dateTime: String(i.startDateTime), timeZone: "Europe/Paris" },
          end: { dateTime: String(i.endDateTime), timeZone: "Europe/Paris" },
          attendees: i.attendeeEmail ? [{ email: String(i.attendeeEmail) }] : undefined,
        });
        return { id: e.id, htmlLink: e.htmlLink };
      },
    },
    {
      def: {
        name: "recent_inbound_emails",
        description: "Derniers emails reçus des prospects/clients (pour savoir quoi traiter ou répondre).",
        input_schema: { type: "object", properties: { limit: { type: "number" } } },
      },
      run: async ({ limit }) =>
        prisma.email.findMany({
          where: { direction: "RECEIVED" },
          orderBy: { createdAt: "desc" },
          take: Math.min(Number(limit) || 10, 30),
          include: { prospect: { select: { id: true, name: true, company: true } } },
        }),
    },
  ],
};
