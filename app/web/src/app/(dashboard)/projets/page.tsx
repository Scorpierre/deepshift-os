"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Calendar, CheckCircle2, Circle,
  Loader2, Plus, Timer, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectStatus = "BRIEF" | "IN_PROGRESS" | "REVIEW" | "DELIVERED" | "COMPLETED" | "ON_HOLD";

type Task = { id: string; done: boolean };
type Milestone = { id: string; tasks: Task[] };
type ProspectRef = { id: string; name: string; company: string | null };

type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  budget: number | null;
  prospect: ProspectRef;
  milestones: Milestone[];
};

type NewProjectForm = {
  prospectId: string;
  name: string;
  deadline: string;
  budget: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ProjectStatus, string> = {
  BRIEF: "Brief", IN_PROGRESS: "En cours", REVIEW: "Révision",
  DELIVERED: "Livré", COMPLETED: "Terminé", ON_HOLD: "En pause",
};
const STATUS_COLORS: Record<ProjectStatus, string> = {
  BRIEF: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  IN_PROGRESS: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  REVIEW: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  DELIVERED: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  COMPLETED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  ON_HOLD: "bg-zinc-500/20 text-zinc-500 border-zinc-500/20",
};

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function isOverdue(d: string | null) {
  if (!d) return false;
  return new Date(d) < new Date();
}

function progress(milestones: Milestone[]) {
  const tasks = milestones.flatMap((m) => m.tasks);
  if (tasks.length === 0) return null;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

// ─── Modal nouveau projet ─────────────────────────────────────────────────────

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [prospects, setProspects] = useState<ProspectRef[]>([]);
  const [form, setForm] = useState<NewProjectForm>({ prospectId: "", name: "", deadline: "", budget: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/prospects").then((r) => r.json()).then(setProspects);
  }, []);

  async function save() {
    if (!form.prospectId || !form.name) return;
    setSaving(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: form.prospectId,
        name: form.name,
        deadline: form.deadline || null,
        budget: form.budget ? parseFloat(form.budget) : null,
      }),
    });
    const project = await res.json();
    onCreated(project.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Nouveau projet</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Client</label>
            <select
              value={form.prospectId}
              onChange={(e) => setForm((f) => ({ ...f, prospectId: e.target.value }))}
              className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
            >
              <option value="">Sélectionner…</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.company ? ` — ${p.company}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Nom du projet</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ex: Site vitrine + SEO"
              className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Deadline</label>
              <input
                type="date" value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget HT (€)</label>
              <input
                type="number" value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                placeholder="ex: 3000"
                className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-xl hover:bg-muted transition-colors">
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving || !form.prospectId || !form.name}
            className="text-sm bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 disabled:opacity-40 px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProjetsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch("/api/projects").then((r) => r.json());
    setProjects(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const active = projects.filter((p) => !["COMPLETED", "ON_HOLD"].includes(p.status));
  const done = projects.filter((p) => p.status === "COMPLETED");
  const onHold = projects.filter((p) => p.status === "ON_HOLD");

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreated={(id) => router.push(`/projets/${id}`)}
        />
      )}

      <div className="flex flex-col h-full overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
          <h1 className="font-semibold text-sm">
            Projets
            {active.length > 0 && (
              <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                {active.length} actif{active.length > 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-sm bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} />
            Nouveau projet
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/40 gap-2">
              <Timer size={36} strokeWidth={1.5} />
              <p className="text-sm">Aucun projet pour l'instant.</p>
              <p className="text-xs">Créez un projet depuis une fiche client ou ici.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {[...active, ...onHold, ...done].map((project) => {
                const pct = progress(project.milestones);
                const overdue = isOverdue(project.deadline) && !["DELIVERED", "COMPLETED"].includes(project.status);

                return (
                  <button
                    key={project.id}
                    onClick={() => router.push(`/projets/${project.id}`)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                  >
                    {/* Status icon */}
                    <div className="shrink-0">
                      {project.status === "COMPLETED"
                        ? <CheckCircle2 size={18} className="text-emerald-400" />
                        : project.status === "ON_HOLD"
                        ? <Circle size={18} className="text-zinc-500" />
                        : <Circle size={18} className="text-violet-400" />}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{project.name}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[project.status]}`}>
                          {STATUS_LABELS[project.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.prospect.name}{project.prospect.company ? ` — ${project.prospect.company}` : ""}
                      </p>
                      {pct !== null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-48">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-400" : "bg-violet-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                        </div>
                      )}
                    </div>

                    {/* Right side */}
                    <div className="shrink-0 text-right space-y-1">
                      {project.deadline && (
                        <div className={`flex items-center gap-1 text-xs justify-end ${overdue ? "text-red-400" : "text-muted-foreground"}`}>
                          {overdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
                          {fmtDate(project.deadline)}
                        </div>
                      )}
                      {project.budget && (
                        <p className="text-xs text-muted-foreground">
                          {project.budget.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
