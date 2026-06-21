"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, ExternalLink, CalendarDays, RefreshCw, Square, CalendarPlus, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  colorId?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
};

type CalTask = {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: "needsAction" | "completed";
};

type CalProposal = {
  id: string;
  subject: string;
  aiMeetingDate: string;
  aiMeetingNote: string | null;
  prospect: { id: string; name: string; company: string | null };
};

type SelectedItem =
  | { type: "event"; data: CalEvent }
  | { type: "task"; data: CalTask };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const COLOR_MAP: Record<string, string> = {
  "1": "bg-sky-500/80", "2": "bg-teal-500/80", "3": "bg-violet-500/80",
  "4": "bg-rose-500/80", "5": "bg-amber-500/80", "6": "bg-orange-500/80",
  "7": "bg-sky-400/80", "8": "bg-slate-500/80", "9": "bg-blue-500/80",
  "10": "bg-emerald-500/80", "11": "bg-red-500/80",
};
const DEFAULT_COLOR = "bg-primary/80";
const TASK_COLOR = "bg-amber-400/20 text-amber-300 border border-amber-400/30";

function eventColor(colorId?: string) {
  return colorId ? (COLOR_MAP[colorId] ?? DEFAULT_COLOR) : DEFAULT_COLOR;
}

function eventStart(ev: CalEvent): Date {
  return new Date(ev.start.dateTime ?? ev.start.date ?? "");
}

function isAllDay(ev: CalEvent) {
  return !ev.start.dateTime;
}

function fmtTime(ev: CalEvent) {
  if (isAllDay(ev)) return "Journée";
  return new Date(ev.start.dateTime!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateRange(ev: CalEvent) {
  const start = new Date(ev.start.dateTime ?? ev.start.date ?? "");
  const end = new Date(ev.end.dateTime ?? ev.end.date ?? "");
  if (isAllDay(ev)) {
    return start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }
  return `${start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · ${
    start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  } → ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const startDow = (firstOfMonth.getDay() + 6) % 7;
  const totalCells = Math.ceil((startDow + lastOfMonth.getDate()) / 7) * 7;
  const cells: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    cells.push(new Date(year, month - 1, 1 - startDow + i));
  }
  return cells;
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ item, onClose }: { item: SelectedItem; onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-3">
        {item.type === "event" ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full shrink-0 ${eventColor(item.data.colorId)}`} />
                <h3 className="font-semibold text-sm leading-snug">{item.data.summary || "(Sans titre)"}</h3>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 text-xs">✕</button>
            </div>
            <p className="text-xs text-muted-foreground">{fmtDateRange(item.data)}</p>
            {item.data.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>📍</span> {item.data.location}
              </p>
            )}
            {item.data.description && (
              <p className="text-xs text-muted-foreground/80 whitespace-pre-wrap line-clamp-4">{item.data.description}</p>
            )}
            {item.data.attendees && item.data.attendees.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Participants</p>
                {item.data.attendees.slice(0, 5).map((a) => (
                  <p key={a.email} className="text-xs text-muted-foreground">
                    {a.displayName ?? a.email}
                    <span className="ml-1 text-[10px] text-muted-foreground/50">
                      {a.responseStatus === "accepted" ? "✓" : a.responseStatus === "declined" ? "✗" : "?"}
                    </span>
                  </p>
                ))}
              </div>
            )}
            {item.data.htmlLink && (
              <a href={item.data.htmlLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
                <ExternalLink size={12} />
                Ouvrir dans Google Calendar
              </a>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Square size={13} className="text-amber-400 shrink-0" />
                <h3 className="font-semibold text-sm leading-snug">{item.data.title || "(Sans titre)"}</h3>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 text-xs">✕</button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tâche · échéance {item.data.due
                ? new Date(item.data.due).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
                : "non définie"}
            </p>
            {item.data.notes && (
              <p className="text-xs text-muted-foreground/80 whitespace-pre-wrap line-clamp-4">{item.data.notes}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ProposalsPanel({ proposals, onConfirm, onDismiss }: {
  proposals: CalProposal[];
  onConfirm: (emailId: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  if (proposals.length === 0) return null;

  return (
    <div className="mx-4 mt-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
          <CalendarPlus size={13} />
          {proposals.length} RDV proposé{proposals.length > 1 ? "s" : ""} par email
        </p>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-0.5">
          <X size={13} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {proposals.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 bg-card rounded-lg px-3 py-2 border border-border">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                {p.prospect.name}{p.prospect.company ? ` — ${p.prospect.company}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {new Date(p.aiMeetingDate).toLocaleDateString("fr-FR", {
                  weekday: "short", day: "numeric", month: "short",
                  hour: "2-digit", minute: "2-digit",
                })}
                {p.aiMeetingNote && <span className="ml-1">· {p.aiMeetingNote}</span>}
              </p>
            </div>
            <button
              disabled={confirming === p.id}
              onClick={async () => {
                setConfirming(p.id);
                await onConfirm(p.id);
                setConfirming(null);
              }}
              className="shrink-0 flex items-center gap-1 text-[11px] font-medium bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-1 rounded-lg hover:bg-amber-400/30 disabled:opacity-50 transition-colors"
            >
              {confirming === p.id ? <Loader2 size={11} className="animate-spin" /> : <CalendarPlus size={11} />}
              Ajouter
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgendaPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [proposals, setProposals] = useState<CalProposal[]>([]);
  const [showProposals, setShowProposals] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/events?year=${y}&month=${m}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur de chargement");
        setEvents([]); setTasks([]);
      } else {
        setEvents(data.events ?? []);
        setTasks(data.tasks ?? []);
      }
    } catch {
      setError("Impossible de contacter l'API Calendar");
      setEvents([]); setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year, month); }, [load, year, month]);

  useEffect(() => {
    fetch("/api/calendar/proposals")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProposals(data); })
      .catch(() => {});
  }, []);

  async function confirmProposal(emailId: string) {
    const res = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId }),
    });
    if (res.ok) {
      setProposals((prev) => prev.filter((p) => p.id !== emailId));
      load(year, month);
    }
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const grid = buildGrid(year, month);

  function itemsForDay(day: Date) {
    const dayEvents = events
      .filter((ev) => sameDay(eventStart(ev), day))
      .sort((a, b) => {
        if (isAllDay(a) && !isAllDay(b)) return -1;
        if (!isAllDay(a) && isAllDay(b)) return 1;
        return eventStart(a).getTime() - eventStart(b).getTime();
      })
      .map((ev) => ({ type: "event" as const, data: ev }));

    const dayTasks = tasks
      .filter((t) => t.due && sameDay(new Date(t.due), day))
      .map((t) => ({ type: "task" as const, data: t }));

    return [...dayEvents, ...dayTasks];
  }

  const isCurrentMonth = (d: Date) => d.getMonth() + 1 === month && d.getFullYear() === year;

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {selected && <DetailPanel item={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <CalendarDays size={18} className="text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{MONTHS_FR[month - 1]} {year}</h1>
            {!loading && !error && (
              <p className="text-xs text-muted-foreground">
                {events.length} event{events.length !== 1 ? "s" : ""}
                {tasks.length > 0 && <span className="ml-2 text-amber-400">· {tasks.length} tâche{tasks.length > 1 ? "s" : ""}</span>}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => load(year, month)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Actualiser">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={prevMonth}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
            Aujourd'hui
          </button>
          <button onClick={nextMonth}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Propositions de RDV */}
      {showProposals && (
        <ProposalsPanel
          proposals={proposals}
          onConfirm={confirmProposal}
          onDismiss={() => setShowProposals(false)}
        />
      )}

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-sm text-red-400">{error}</p>
            {(error.includes("403") || error.includes("401") || error.includes("scope")) && (
              <p className="text-xs text-muted-foreground max-w-sm">
                Lance <code className="bg-muted px-1 rounded">node get-refresh-token.mjs</code> depuis la racine pour générer un nouveau token, puis mets à jour <code className="bg-muted px-1 rounded">GOOGLE_REFRESH_TOKEN</code>.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0">
            <div className="grid grid-cols-7 mb-1">
              {DAYS_FR.map((d) => (
                <div key={d} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 text-center py-1">
                  {d}
                </div>
              ))}
            </div>

            <div
              className="grid grid-cols-7 flex-1 gap-px bg-border rounded-lg overflow-hidden"
              style={{ gridTemplateRows: `repeat(${grid.length / 7}, minmax(0, 1fr))` }}
            >
              {grid.map((day, i) => {
                const isToday = sameDay(day, today);
                const inMonth = isCurrentMonth(day);
                const items = itemsForDay(day);

                return (
                  <div key={i} className={`bg-card flex flex-col p-1.5 min-h-0 ${!inMonth ? "opacity-40" : ""}`}>
                    <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 shrink-0 ${
                      isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}>
                      {day.getDate()}
                    </div>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {items.slice(0, 3).map((item) =>
                        item.type === "event" ? (
                          <button
                            key={item.data.id}
                            onClick={() => setSelected(item)}
                            className={`text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate text-white w-full ${eventColor(item.data.colorId)} hover:opacity-90 transition-opacity`}
                          >
                            {!isAllDay(item.data) && <span className="opacity-70 mr-1">{fmtTime(item.data)}</span>}
                            {item.data.summary || "(Sans titre)"}
                          </button>
                        ) : (
                          <button
                            key={item.data.id}
                            onClick={() => setSelected(item)}
                            className={`text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate w-full flex items-center gap-1 ${TASK_COLOR} hover:opacity-90 transition-opacity`}
                          >
                            <Square size={9} className="shrink-0" />
                            {item.data.title || "(Sans titre)"}
                          </button>
                        )
                      )}
                      {items.length > 3 && (
                        <p className="text-[10px] text-muted-foreground pl-1">+{items.length - 3} autres</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
