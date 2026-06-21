/**
 * Client Google Calendar minimal — OAuth2 avec refresh token.
 * Même token que Gmail (doit inclure le scope calendar).
 */

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Calendar token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  colorId?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  status?: string;
};

/**
 * Récupère les events Google Calendar entre deux dates ISO.
 * Par défaut le calendrier principal (primary).
 */
export async function listCalendarEvents(
  timeMin: string,
  timeMax: string,
  calendarId = "primary"
): Promise<CalendarEvent[]> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Calendar API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return (data.items ?? []) as CalendarEvent[];
}

export type GoogleTask = {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: "needsAction" | "completed";
};

export async function listGoogleTasks(
  timeMin: string,
  timeMax: string,
  tasklistId = "@default"
): Promise<GoogleTask[]> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    dueMin: timeMin,
    dueMax: timeMax,
    showCompleted: "false",
    showHidden: "false",
    maxResults: "100",
  });

  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(tasklistId)}/tasks?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Tasks API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return (data.items ?? []) as GoogleTask[];
}

/**
 * Crée un event dans Google Calendar.
 */
export async function createCalendarEvent(
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: { email: string }[];
  },
  calendarId = "primary"
): Promise<CalendarEvent> {
  const token = await getAccessToken();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Calendar create error ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json();
}
