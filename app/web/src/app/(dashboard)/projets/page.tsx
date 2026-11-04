"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowUpRight, CalendarClock, Euro, FolderKanban, LayoutGrid,
  List, Loader2, Plus, Rocket, Search, Target, X,
} from "lucide-react";

import { DateField } from "@/components/ui/date-field";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectStatus = "BRIEF" | "IN_PROGRESS" | "REVIEW" | "DELIVERED" | "COMPLETED" | "MAINTENANCE" | "ON_HOLD";

type Task = { id: string; done: boolean };
type Milestone = { id: string; name: string; status: "PENDING" | "IN_PROGRESS" | "DONE"; dueAt: string | null; tasks: Task[] };
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
  DELIVERED: "Livré", COMPLETED: "Terminé", MAINTENANCE: "Maintenance", ON_HOLD: "En pause",
};
const STATUS_COLORS: Record<ProjectStatus, string> = {
  BRIEF: "bg-zinc-500/15 text-zinc-300 border-zinc-500/25",
  IN_PROGRESS: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  REVIEW: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  DELIVERED: "bg-teal-500/15 text-teal-300 border-teal-500/25",
  COMPLETED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  MAINTENANCE: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  ON_HOLD: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};
const STATUS_DOT: Record<ProjectStatus, string> = {
  BRIEF: "bg-zinc-400", IN_PROGRESS: "bg-blue-400", REVIEW: "bg-amber-400", DELIVERED: "bg-teal-400",
  COMPLETED: "bg-emerald-400", MAINTENANCE: "bg-violet-400", ON_HOLD: "bg-zinc-600",
};

const CLOSED: ProjectStatus[] = ["DELIVERED", "COMPLETED"];
const FILTERS: { key: string; label: string; match: (p: Project) => boolean }[] = [
  { key: "active", label: "Actifs", match: (p) => !["COMPLETED", "ON_HOLD", "MAINTENANCE"].includes(p.status) },
  { key: "late", label: "En retard", match: (p) => isLate(p) },
  { key: "hold", label: "En pause", match: (p) => p.status === "ON_HOLD" },
  { key: "done", label: "Terminés", match: (p) => ["COMPLETED", "MAINTENANCE", "DELIVERED"].includes(p.status) },
  { key: "all", label: "Tous", match: () => true },
];

const eur = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function daysLeft(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function isLate(p: Project) {
  const n = daysLeft(p.deadline);
  return n !== null && n < 0 && !CLOSED.includes(p.status);
}

function progress(milestones: Milestone[]) {
  const tasks = milestones.flatMap((m) => m.tasks);
  if (tasks.length > 0) return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
  if (milestones.length > 0) return Math.round((milestones.filter((m) => m.status === "DONE").length / milestones.length) * 100);
  return null;
}

function nextMilestone(p: Project) {
  return p.milestones.find((m) => m.status !== "DONE") ?? null;
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function deadlineLabel(p: Project) {
  const n = daysLeft(p.deadline);
  if (n === null || CLOSED.includes(p.status)) return { text: p.deadline ? fmtDate(p.deadline)! : "—", tone: "text-muted-foreground" };
  if (n < 0) return { text: `${-n} j de retard`, tone: "text-red-400" };
  if (n <= 7) return { text: n === 0 ? "Aujourd'hui" : `Dans ${n} j`, tone: "text-amber-400" };
  return { text: fmtDate(p.deadline)!, tone: "text-muted-foreground" };
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
              <DateField
                value={form.deadline}
                onChange={(v) => setForm((f) => ({ ...f, deadline: v }))}
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

// ─── Composants ───────────────────────────────────────────────────────────────

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof Target; label: string; value: string; hint?: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 flex items-start gap-3">
      <div className={`size-9 rounded-lg grid place-items-center shrink-0 ${tone}`}><Icon size={16} /></div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tracking-tight leading-tight">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground/70 truncate">{hint}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ pct, late }: { pct: number | null; late: boolean }) {
  if (pct === null) return <p className="text-[11px] text-muted-foreground/50">Pas encore de tâches</p>;
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-400" : late ? "bg-red-400" : "bg-gradient-to-r from-violet-500 to-violet-300"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const pct = progress(project.milestones);
  const late = isLate(project);
  const next = nextMilestone(project);
  const dl = deadlineLabel(project);
  const doneMs = project.milestones.filter((m) => m.status === "DONE").length;

  return (
    <button
      onClick={onOpen}
      className="group text-left rounded-xl border border-border bg-card/60 p-4 space-y-4 transition-all hover:border-violet-500/40 hover:bg-card hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-gradient-to-br from-violet-500/30 to-blue-500/20 border border-violet-500/20 grid place-items-center text-[11px] font-semibold text-violet-200 shrink-0">
            {initials(project.prospect.company ?? project.prospect.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{project.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{project.prospect.company ?? project.prospect.name}</p>
          </div>
        </div>
        <ArrowUpRight size={15} className="text-muted-foreground/30 group-hover:text-violet-300 transition-colors shrink-0" />
      </div>

      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[project.status]}`}>
          <span className={`size-1.5 rounded-full ${STATUS_DOT[project.status]}`} />
          {STATUS_LABELS[project.status]}
        </span>
        {late && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-300 bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded-full">
            <AlertTriangle size={10} /> Retard
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <ProgressBar pct={pct} late={late} />
        <p className="text-[11px] text-muted-foreground/70 truncate">
          {next ? <>Prochain jalon : <span className="text-muted-foreground">{next.name}</span></> : project.milestones.length ? "Tous les jalons terminés" : "Aucun jalon défini"}
          {project.milestones.length > 0 && <span className="ml-1.5 text-muted-foreground/50">· {doneMs}/{project.milestones.length}</span>}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/70 text-xs">
        <span className={`inline-flex items-center gap-1.5 ${dl.tone}`}><CalendarClock size={12} />{dl.text}</span>
        <span className="text-muted-foreground tabular-nums">{project.budget ? eur(project.budget) : "—"}</span>
      </div>
    </button>
  );
}

function ProjectRow({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const pct = progress(project.milestones);
  const late = isLate(project);
  const dl = deadlineLabel(project);
  const next = nextMilestone(project);

  return (
    <button
      onClick={onOpen}
      className="w-full grid grid-cols-[minmax(0,2.2fr)_110px_minmax(0,1.4fr)_minmax(0,1.6fr)_110px_90px] items-center gap-4 px-4 py-3 text-left hover:bg-muted/30 transition-colors max-lg:grid-cols-[minmax(0,1fr)_110px_90px]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-8 rounded-lg bg-violet-500/15 border border-violet-500/20 grid place-items-center text-[10px] font-semibold text-violet-200 shrink-0">
          {initials(project.prospect.company ?? project.prospect.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{project.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{project.prospect.company ?? project.prospect.name}</p>
        </div>
      </div>
      <span className={`justify-self-start inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[project.status]}`}>
        <span className={`size-1.5 rounded-full ${STATUS_DOT[project.status]}`} />
        {STATUS_LABELS[project.status]}
      </span>
      <div className="max-lg:hidden"><ProgressBar pct={pct} late={late} /></div>
      <p className="max-lg:hidden text-xs text-muted-foreground truncate">{next?.name ?? "—"}</p>
      <span className={`max-lg:hidden text-xs inline-flex items-center gap-1.5 ${dl.tone}`}>
        {late ? <AlertTriangle size={11} /> : <CalendarClock size={11} />}{dl.text}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums text-right">{project.budget ? eur(project.budget) : "—"}</span>
    </button>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProjetsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");

  const changeView = setView;

  const load = useCallback(async () => {
    const data = await fetch("/api/projects").then((r) => r.json());
    setProjects(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const stats = useMemo(() => {
    const active = projects.filter(FILTERS[0].match);
    const late = projects.filter(isLate);
    const pipeline = active.reduce((s, p) => s + (p.budget ?? 0), 0);
    const soon = active
      .filter((p) => p.deadline && (daysLeft(p.deadline) ?? 99) >= 0)
      .sort((a, b) => +new Date(a.deadline!) - +new Date(b.deadline!))[0];
    return { active, late, pipeline, soon };
  }, [projects]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, projects.filter(f.match).length])), [projects]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    const q = query.trim().toLowerCase();
    return projects
      .filter(f.match)
      .filter((p) => !q || `${p.name} ${p.prospect.name} ${p.prospect.company ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (a.deadline ? +new Date(a.deadline) : Infinity) - (b.deadline ? +new Date(b.deadline) : Infinity));
  }, [projects, filter, query]);

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
        <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
          <div>
            <h1 className="font-semibold text-base tracking-tight">Projets</h1>
            <p className="text-xs text-muted-foreground">Suivi de production, jalons et livraisons</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white px-3.5 py-2 rounded-lg shadow-lg shadow-violet-500/20 transition-colors"
          >
            <Plus size={14} />
            Nouveau projet
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5 max-w-[1400px] mx-auto">
            {/* KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Stat icon={Rocket} label="Projets actifs" value={String(stats.active.length)} hint={`${projects.length} au total`} tone="bg-violet-500/15 text-violet-300" />
              <Stat icon={AlertTriangle} label="En retard" value={String(stats.late.length)} hint={stats.late[0]?.name ?? "Tout est dans les temps"} tone={stats.late.length ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"} />
              <Stat icon={Euro} label="Budget en cours" value={eur(stats.pipeline)} hint="Projets actifs, HT" tone="bg-blue-500/15 text-blue-300" />
              <Stat icon={Target} label="Prochaine échéance" value={stats.soon ? fmtDate(stats.soon.deadline)! : "—"} hint={stats.soon?.name ?? "Aucune deadline"} tone="bg-amber-500/15 text-amber-300" />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5 ${filter === f.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {f.label}
                    <span className={`text-[10px] tabular-nums ${filter === f.key ? "text-violet-300" : "text-muted-foreground/50"}`}>{counts[f.key]}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 min-w-48 max-w-xs relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un projet ou client…"
                  className="w-full text-sm bg-muted/30 border border-border rounded-lg pl-8 pr-3 py-2 outline-none focus:border-violet-500/40 transition-colors placeholder:text-muted-foreground/40"
                />
              </div>

              <div className="ml-auto flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border">
                {([["cards", LayoutGrid], ["list", List]] as const).map(([k, Icon]) => (
                  <button
                    key={k}
                    onClick={() => changeView(k)}
                    aria-label={k === "cards" ? "Vue cartes" : "Vue liste"}
                    className={`p-1.5 rounded-md transition-colors ${view === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>

            {/* Contenu */}
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/50 gap-2 rounded-xl border border-dashed border-border">
                <FolderKanban size={36} strokeWidth={1.5} />
                <p className="text-sm">{projects.length === 0 ? "Aucun projet pour l'instant." : "Aucun projet ne correspond."}</p>
                {projects.length === 0 && <p className="text-xs">Créez un projet depuis une fiche client ou ici.</p>}
              </div>
            ) : view === "cards" ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((p) => <ProjectCard key={p.id} project={p} onOpen={() => router.push(`/projets/${p.id}`)} />)}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
                <div className="grid grid-cols-[minmax(0,2.2fr)_110px_minmax(0,1.4fr)_minmax(0,1.6fr)_110px_90px] max-lg:grid-cols-[minmax(0,1fr)_110px_90px] gap-4 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 border-b border-border">
                  <span>Projet</span><span>Statut</span><span className="max-lg:hidden">Avancement</span>
                  <span className="max-lg:hidden">Prochain jalon</span><span className="max-lg:hidden">Échéance</span><span className="text-right">Budget</span>
                </div>
                <div className="divide-y divide-border/70">
                  {visible.map((p) => <ProjectRow key={p.id} project={p} onOpen={() => router.push(`/projets/${p.id}`)} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
