"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, Check, ChevronDown, ExternalLink, Loader2,
  MessageSquare, Package, Plus, RefreshCw, Sparkles, Trash2, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectStatus = "BRIEF" | "IN_PROGRESS" | "REVIEW" | "DELIVERED" | "COMPLETED" | "MAINTENANCE" | "ON_HOLD";
type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "DONE";
type ClientNoteType = "MEETING" | "FEEDBACK" | "DECISION" | "OTHER";

type Task = { id: string; title: string; done: boolean; order: number };
type Milestone = { id: string; name: string; description: string | null; dueAt: string | null; status: MilestoneStatus; order: number; tasks: Task[] };
type Delivery = { id: string; title: string; description: string | null; deliveredAt: string; clientOk: boolean | null; feedback: string | null };
type ClientNote = { id: string; content: string; type: ClientNoteType; createdAt: string };
type ProspectRef = { id: string; name: string; company: string | null; email: string };

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  budget: number | null;
  prospect: ProspectRef;
  milestones: Milestone[];
  deliveries: Delivery[];
  clientNotes: ClientNote[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ProjectStatus, string> = {
  BRIEF: "Brief", IN_PROGRESS: "En cours", REVIEW: "Révision",
  DELIVERED: "Livré", COMPLETED: "Terminé", MAINTENANCE: "Maintenance", ON_HOLD: "En pause",
};
const STATUS_COLORS: Record<ProjectStatus, string> = {
  BRIEF: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  IN_PROGRESS: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  REVIEW: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  DELIVERED: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  COMPLETED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  MAINTENANCE: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  ON_HOLD: "bg-zinc-500/20 text-zinc-500 border-zinc-500/20",
};
const MILESTONE_COLORS: Record<MilestoneStatus, string> = {
  PENDING: "text-zinc-500", IN_PROGRESS: "text-blue-400", DONE: "text-emerald-400",
};
const NOTE_TYPE_LABELS: Record<ClientNoteType, string> = {
  MEETING: "Réunion", FEEDBACK: "Feedback", DECISION: "Décision", OTHER: "Note",
};
const NOTE_TYPE_COLORS: Record<ClientNoteType, string> = {
  MEETING: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  FEEDBACK: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  DECISION: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  OTHER: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateInput(d: string | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function totalTasks(milestones: Milestone[]) {
  const all = milestones.flatMap((m) => m.tasks);
  return { total: all.length, done: all.filter((t) => t.done).length };
}

// ─── StatusDropdown ───────────────────────────────────────────────────────────

function StatusDropdown({ value, onChange }: { value: ProjectStatus; onChange: (s: ProjectStatus) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${STATUS_COLORS[value]}`}
      >
        {STATUS_LABELS[value]}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-36">
            {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
              <button key={s} onClick={() => { setOpen(false); onChange(s); }}
                className={`w-full text-left px-4 py-1.5 text-sm hover:bg-muted transition-colors ${s === value ? "font-medium text-primary" : ""}`}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── AutoSaveTextarea ─────────────────────────────────────────────────────────

function AutoSaveTextarea({ value, placeholder, onSave }: { value: string | null; placeholder?: string; onSave: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (document.activeElement !== ref.current) setText(value ?? ""); }, [value]);
  return (
    <textarea ref={ref} value={text} rows={4}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onSave(text.trim() || null)}
      placeholder={placeholder}
      className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2.5 resize-none outline-none focus:border-primary/40 transition-all placeholder:text-muted-foreground/35 leading-relaxed"
    />
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "milestones" | "deliveries" | "notes">("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // IA génération
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // New milestone form
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ name: "", dueAt: "" });

  // New task inputs per milestone
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  // New delivery form
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [newDelivery, setNewDelivery] = useState({ title: "", description: "" });

  // New note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [newNote, setNewNote] = useState({ content: "", type: "OTHER" as ClientNoteType });

  const load = useCallback(async () => {
    const data = await fetch(`/api/projects/${id}`).then((r) => r.json());
    setProject(data);
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function generateMilestones(clearExisting: boolean) {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/ai/generate-milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, clearExisting }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGenerateError(data.error ?? `Erreur ${res.status}`);
      } else {
        await load();
      }
    } catch {
      setGenerateError("Erreur réseau.");
    } finally {
      setGenerating(false);
    }
  }

  async function deleteProject() {
    setDeleting(true);
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/projets");
  }

  async function patch(data: Record<string, unknown>) {
    const updated = await fetch(`/api/projects/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then((r) => r.json());
    setProject(updated);
  }

  // ── Milestones ──────────────────────────────────────────────────────────────

  async function addMilestone() {
    if (!newMilestone.name.trim()) return;
    await fetch(`/api/projects/${id}/milestones`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newMilestone.name, dueAt: newMilestone.dueAt || null }),
    });
    setNewMilestone({ name: "", dueAt: "" });
    setShowMilestoneForm(false);
    await load();
  }

  async function patchMilestone(milestoneId: string, data: Record<string, unknown>) {
    await fetch(`/api/milestones/${milestoneId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    await load();
  }

  async function deleteMilestone(milestoneId: string) {
    await fetch(`/api/milestones/${milestoneId}`, { method: "DELETE" });
    await load();
  }

  // ── Tasks ───────────────────────────────────────────────────────────────────

  async function addTask(milestoneId: string) {
    const title = taskInputs[milestoneId]?.trim();
    if (!title) return;
    await fetch(`/api/milestones/${milestoneId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
    });
    setTaskInputs((prev) => ({ ...prev, [milestoneId]: "" }));
    await load();
  }

  async function toggleTask(taskId: string, done: boolean) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done }),
    });
    await load();
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    await load();
  }

  // ── Deliveries ──────────────────────────────────────────────────────────────

  async function addDelivery() {
    if (!newDelivery.title.trim()) return;
    await fetch(`/api/projects/${id}/deliveries`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newDelivery.title, description: newDelivery.description || null }),
    });
    setNewDelivery({ title: "", description: "" });
    setShowDeliveryForm(false);
    await load();
  }

  async function setDeliveryValidation(deliveryId: string, clientOk: boolean | null) {
    await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientOk }),
    });
    await load();
  }

  // ── Notes ───────────────────────────────────────────────────────────────────

  async function addNote() {
    if (!newNote.content.trim()) return;
    await fetch(`/api/projects/${id}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newNote),
    });
    setNewNote({ content: "", type: "OTHER" });
    setShowNoteForm(false);
    await load();
  }

  async function deleteNote(noteId: string) {
    await fetch(`/api/client-notes/${noteId}`, { method: "DELETE" });
    await load();
  }

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={22} className="animate-spin text-muted-foreground" />
    </div>
  );

  if (!project) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Projet introuvable.
    </div>
  );

  const { total, done } = totalTasks(project.milestones);
  const pct = total > 0 ? Math.round((done / total) * 100) : null;

  const tabs = [
    { id: "overview" as const, label: "Vue d'ensemble" },
    { id: "milestones" as const, label: `Étapes${project.milestones.length > 0 ? ` · ${project.milestones.length}` : ""}` },
    { id: "deliveries" as const, label: `Livraisons${project.deliveries.length > 0 ? ` · ${project.deliveries.length}` : ""}` },
    { id: "notes" as const, label: `Échanges${project.clientNotes.length > 0 ? ` · ${project.clientNotes.length}` : ""}` },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
        <button onClick={() => router.push("/projets")}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
          <ArrowLeft size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm truncate">{project.name}</h1>
          <button
            onClick={() => router.push(`/crm/${project.prospect.id}`)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {project.prospect.name}{project.prospect.company ? ` — ${project.prospect.company}` : ""}
            <ExternalLink size={9} className="shrink-0 opacity-50" />
          </button>
        </div>

        {pct !== null && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-400" : "bg-violet-400"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
        )}

        <StatusDropdown value={project.status} onChange={(s) => patch({ status: s })} />

        {confirmDelete ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Supprimer ?</span>
            <button
              onClick={deleteProject}
              disabled={deleting}
              className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              {deleting && <Loader2 size={10} className="animate-spin" />}
              Confirmer
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-muted-foreground hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-border shrink-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${tab === t.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* ── Vue d'ensemble ─────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="max-w-2xl space-y-6">
            <Section title="Brief / Objectifs">
              <AutoSaveTextarea
                value={project.description}
                placeholder="Décris le projet, les objectifs, le contexte, les attentes client…"
                onSave={(v) => patch({ description: v })}
              />
            </Section>

            <Section title="Infos">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Date de début", field: "startDate", value: project.startDate },
                  { label: "Deadline", field: "deadline", value: project.deadline },
                ].map(({ label, field, value }) => (
                  <div key={field} className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Calendar size={9} /> {label}
                    </label>
                    <input
                      type="date"
                      defaultValue={fmtDateInput(value)}
                      onBlur={(e) => patch({ [field]: e.target.value || null })}
                      className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget HT (€)</label>
                  <input
                    type="number"
                    defaultValue={project.budget ?? ""}
                    onBlur={(e) => patch({ budget: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="ex: 3000"
                    className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Client</label>
                  <button
                    onClick={() => router.push(`/crm/${project.prospect.id}`)}
                    className="w-full text-sm text-left text-muted-foreground hover:text-foreground bg-muted/30 border border-border rounded-xl px-3 py-2 transition-colors truncate"
                  >
                    {project.prospect.name}
                  </button>
                </div>
              </div>
            </Section>

            {pct !== null && (
              <Section title="Avancement global">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{done} / {total} tâches</span>
                    <span className={pct === 100 ? "text-emerald-400 font-medium" : "text-foreground"}>{pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-400" : "bg-violet-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ── Étapes & tâches ────────────────────────────────────────────── */}
        {tab === "milestones" && (
          <div className="max-w-2xl space-y-4">

            {/* Barre d'actions IA */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground/50">
                {project.milestones.length > 0
                  ? `${totalTasks(project.milestones).done}/${totalTasks(project.milestones).total} tâches`
                  : ""}
              </p>
              <div className="flex items-center gap-2">
                {project.milestones.length > 0 && (
                  <button
                    onClick={() => generateMilestones(true)}
                    disabled={generating}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/80 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {generating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    Régénérer
                  </button>
                )}
                <button
                  onClick={() => generateMilestones(false)}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-xs bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/20 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {generating
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Sparkles size={11} />}
                  {generating ? "Génération…" : "Générer avec IA"}
                </button>
              </div>
            </div>

            {/* Erreur génération */}
            {generateError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {generateError}
              </p>
            )}

            {project.milestones.length === 0 && !showMilestoneForm && (
              <p className="text-sm text-muted-foreground/40 text-center py-8">Aucune étape définie.</p>
            )}

            {project.milestones.map((m) => {
              const mDone = m.tasks.filter((t) => t.done).length;
              const mTotal = m.tasks.length;
              return (
                <div key={m.id} className="border border-border rounded-2xl overflow-hidden">
                  {/* Milestone header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
                    <button
                      onClick={() => patchMilestone(m.id, { status: m.status === "DONE" ? "PENDING" : m.status === "PENDING" ? "IN_PROGRESS" : "DONE" })}
                      className={`shrink-0 transition-colors ${MILESTONE_COLORS[m.status]}`}
                    >
                      <Check size={16} strokeWidth={m.status === "DONE" ? 2.5 : 1.5} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${m.status === "DONE" ? "line-through text-muted-foreground" : ""}`}>{m.name}</p>
                      {m.dueAt && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar size={9} /> {fmtDate(m.dueAt)}
                          {mTotal > 0 && <span className="ml-1">· {mDone}/{mTotal}</span>}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteMilestone(m.id)}
                      className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Tasks */}
                  <div className="px-4 py-2 space-y-1">
                    {m.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2.5 py-1 group/task">
                        <button onClick={() => toggleTask(task.id, !task.done)}
                          className={`shrink-0 size-4 rounded border flex items-center justify-center transition-colors ${task.done ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-border hover:border-primary/40"}`}>
                          {task.done && <Check size={10} />}
                        </button>
                        <span className={`text-sm flex-1 ${task.done ? "line-through text-muted-foreground/50" : ""}`}>{task.title}</span>
                        <button onClick={() => deleteTask(task.id)}
                          className="opacity-0 group-hover/task:opacity-100 p-0.5 text-muted-foreground hover:text-red-400 transition-all shrink-0">
                          <X size={11} />
                        </button>
                      </div>
                    ))}

                    {/* Add task input */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="shrink-0 size-4" />
                      <input
                        value={taskInputs[m.id] ?? ""}
                        onChange={(e) => setTaskInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") addTask(m.id); }}
                        placeholder="+ Ajouter une tâche…"
                        className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/30 py-1"
                      />
                      {taskInputs[m.id]?.trim() && (
                        <button onClick={() => addTask(m.id)}
                          className="text-xs text-primary hover:text-primary/80 shrink-0 transition-colors">
                          <Check size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New milestone form */}
            {showMilestoneForm ? (
              <div className="border border-border rounded-2xl p-4 space-y-3">
                <input
                  value={newMilestone.name}
                  onChange={(e) => setNewMilestone((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nom de l'étape"
                  autoFocus
                  className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newMilestone.dueAt}
                    onChange={(e) => setNewMilestone((f) => ({ ...f, dueAt: e.target.value }))}
                    className="text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
                  />
                  <button onClick={addMilestone}
                    className="text-sm bg-primary text-primary-foreground px-3 py-2 rounded-xl hover:bg-primary/90 transition-colors">
                    Ajouter
                  </button>
                  <button onClick={() => setShowMilestoneForm(false)}
                    className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-muted transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowMilestoneForm(true)}
                className="w-full text-sm text-muted-foreground/40 border border-dashed border-border/60 rounded-2xl py-3 hover:text-foreground hover:border-border transition-colors flex items-center justify-center gap-1.5">
                <Plus size={13} /> Ajouter une étape
              </button>
            )}
          </div>
        )}

        {/* ── Livraisons ─────────────────────────────────────────────────── */}
        {tab === "deliveries" && (
          <div className="max-w-2xl space-y-3">
            {project.deliveries.length === 0 && !showDeliveryForm && (
              <p className="text-sm text-muted-foreground/40 text-center py-8">Aucune livraison enregistrée.</p>
            )}

            {project.deliveries.map((d) => (
              <div key={d.id} className={`border rounded-2xl p-4 space-y-2 ${d.clientOk === true ? "border-emerald-500/20 bg-emerald-500/5" : d.clientOk === false ? "border-red-500/20 bg-red-500/5" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Package size={13} className="text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium">{d.title}</p>
                    </div>
                    {d.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{d.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{fmtDate(d.deliveredAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setDeliveryValidation(d.id, d.clientOk === true ? null : true)}
                      className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${d.clientOk === true ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400"}`}>
                      <Check size={12} /> OK
                    </button>
                    <button
                      onClick={() => setDeliveryValidation(d.id, d.clientOk === false ? null : false)}
                      className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${d.clientOk === false ? "bg-red-500/20 text-red-400" : "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"}`}>
                      <X size={12} /> À revoir
                    </button>
                  </div>
                </div>
                {d.feedback && (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 leading-relaxed">{d.feedback}</p>
                )}
              </div>
            ))}

            {showDeliveryForm ? (
              <div className="border border-border rounded-2xl p-4 space-y-3">
                <input
                  value={newDelivery.title}
                  onChange={(e) => setNewDelivery((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Titre de la livraison"
                  autoFocus
                  className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
                />
                <textarea
                  value={newDelivery.description}
                  onChange={(e) => setNewDelivery((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description (optionnel)"
                  rows={2}
                  className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 resize-none outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
                />
                <div className="flex gap-2">
                  <button onClick={addDelivery}
                    className="text-sm bg-primary text-primary-foreground px-3 py-2 rounded-xl hover:bg-primary/90 transition-colors">
                    Enregistrer
                  </button>
                  <button onClick={() => setShowDeliveryForm(false)}
                    className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-muted transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowDeliveryForm(true)}
                className="w-full text-sm text-muted-foreground/40 border border-dashed border-border/60 rounded-2xl py-3 hover:text-foreground hover:border-border transition-colors flex items-center justify-center gap-1.5">
                <Plus size={13} /> Enregistrer une livraison
              </button>
            )}
          </div>
        )}

        {/* ── Échanges client ────────────────────────────────────────────── */}
        {tab === "notes" && (
          <div className="max-w-2xl space-y-3">
            {project.clientNotes.length === 0 && !showNoteForm && (
              <p className="text-sm text-muted-foreground/40 text-center py-8">Aucun échange enregistré.</p>
            )}

            {project.clientNotes.map((note) => (
              <div key={note.id} className="border border-border rounded-2xl p-4 space-y-2 group/note">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${NOTE_TYPE_COLORS[note.type]}`}>
                      {NOTE_TYPE_LABELS[note.type]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{fmtDate(note.createdAt)}</span>
                  </div>
                  <button onClick={() => deleteNote(note.id)}
                    className="opacity-0 group-hover/note:opacity-100 p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}

            {showNoteForm ? (
              <div className="border border-border rounded-2xl p-4 space-y-3">
                <div className="flex gap-2">
                  {(["MEETING", "FEEDBACK", "DECISION", "OTHER"] as ClientNoteType[]).map((t) => (
                    <button key={t} onClick={() => setNewNote((f) => ({ ...f, type: t }))}
                      className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${newNote.type === t ? NOTE_TYPE_COLORS[t] : "border-border text-muted-foreground hover:border-border/80"}`}>
                      {NOTE_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Notes de la réunion, feedback reçu, décision prise…"
                  rows={4}
                  autoFocus
                  className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2.5 resize-none outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35 leading-relaxed"
                />
                <div className="flex gap-2">
                  <button onClick={addNote}
                    className="text-sm bg-primary text-primary-foreground px-3 py-2 rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                    <MessageSquare size={12} /> Enregistrer
                  </button>
                  <button onClick={() => setShowNoteForm(false)}
                    className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-muted transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNoteForm(true)}
                className="w-full text-sm text-muted-foreground/40 border border-dashed border-border/60 rounded-2xl py-3 hover:text-foreground hover:border-border transition-colors flex items-center justify-center gap-1.5">
                <Plus size={13} /> Ajouter une note
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
