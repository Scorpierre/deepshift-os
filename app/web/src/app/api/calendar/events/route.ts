import { NextRequest, NextResponse } from "next/server";
import { listCalendarEvents, listGoogleTasks, createCalendarEvent } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const start = new Date(year, month - 2, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  try {
    const [events, tasks] = await Promise.all([
      listCalendarEvents(start.toISOString(), end.toISOString()),
      listGoogleTasks(start.toISOString(), end.toISOString()).catch(() => []),
    ]);
    return NextResponse.json({ events, tasks });
  } catch (err: any) {
    console.error("[GET /api/calendar/events]", err?.message);
    return NextResponse.json({ error: err?.message ?? "Erreur Calendar API" }, { status: 500 });
  }
}

// Confirme un RDV proposé par email → crée l'event dans Google Calendar
export async function POST(request: NextRequest) {
  const { emailId } = await request.json();

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { prospect: true },
  });

  if (!email || !email.aiMeetingDate) {
    return NextResponse.json({ error: "Email ou date de RDV introuvable" }, { status: 404 });
  }

  const start = email.aiMeetingDate;
  const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h par défaut

  try {
    const event = await createCalendarEvent({
      summary: `RDV ${email.prospect.name}${email.prospect.company ? ` — ${email.prospect.company}` : ""}`,
      description: email.aiMeetingNote ?? `Issu de l'email : ${email.subject}`,
      start: { dateTime: start.toISOString(), timeZone: "Europe/Paris" },
      end: { dateTime: end.toISOString(), timeZone: "Europe/Paris" },
      attendees: [{ email: email.prospect.email }],
    });

    await prisma.email.update({
      where: { id: emailId },
      data: { meetingEventId: event.id },
    });

    return NextResponse.json({ eventId: event.id, htmlLink: event.htmlLink });
  } catch (err: any) {
    console.error("[POST /api/calendar/events]", err?.message);
    return NextResponse.json({ error: err?.message ?? "Erreur création event" }, { status: 500 });
  }
}
