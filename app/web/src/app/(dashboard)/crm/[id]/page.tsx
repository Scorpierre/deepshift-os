"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Check, ChevronDown,
  FileText, FolderKanban, Loader2, Mail, Paperclip, Pencil, Plus, Receipt, Send,
  Sparkles, Trash2, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProspectStatus =
  | "NEW" | "SCORING" | "SCORED" | "VIP"
  | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT"
  | "NEGOTIATION" | "WON" | "LOST" | "ARCHIVED";

const STATUS_LABELS: Record<ProspectStatus, string> = {
  NEW: "Nouveau",
  SCORING: "Scoring…",
  SCORED: "Scoré",
  VIP: "VIP",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  PROPOSAL_SENT: "Devis envoyé",
  NEGOTIATION: "Négociation",
  WON: "Signé",
  LOST: "Perdu",
  ARCHIVED: "Archivé",
};

const STATUS_COLORS: Record<ProspectStatus, string> = {
  NEW: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  SCORING: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  SCORED: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  VIP: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  CONTACTED: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  QUALIFIED: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  PROPOSAL_SENT: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  NEGOTIATION: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  WON: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  LOST: "bg-red-500/20 text-red-300 border-red-500/30",
  ARCHIVED: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const NEED_TYPES = ["webapp", "site", "consulting", "api", "ecommerce", "autre"];
const SOURCES = ["LinkedIn", "Référence", "GitHub", "Site web", "Réseau", "Autre"];

type EmailEntry = {
  id: string;
  sentAt: string;
  direction: "SENT" | "RECEIVED";
  subject: string;
  body: string;
  aiAnalysis: string | null;
  aiIntent: string | null;
};

type Reminder = {
  id: string;
  dueAt: string;
  note: string;
  status: "PENDING" | "DONE" | "SNOOZED";
  type: string;
};

type ProspectDocumentRef = {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: string;
};

type FinanceSummary = {
  quotes: { id: string; number: string; totalHT: number; status: string }[];
  invoices: { id: string; number: string; totalHT: number; status: string }[];
};

type Prospect = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  status: ProspectStatus;
  score: number | null;
  needType: string[];
  estimatedBudget: number | null;
  source: string | null;
  lastContactedAt: string | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  companyDescription: string | null;
  prospectNotes: string | null;
  aiSummary: string | null;
  aiScoreReason: string | null;
  aiTags: string[];
  aiRecommendedAction: string | null;
  emails: EmailEntry[];
  reminders: Reminder[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number | null) {
  if (s === null) return "bg-zinc-500/20 text-zinc-400";
  if (s >= 8) return "bg-emerald-500/20 text-emerald-400";
  if (s >= 5) return "bg-amber-500/20 text-amber-400";
  return "bg-red-500/20 text-red-400";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDatetime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ─── InlineField ──────────────────────────────────────────────────────────────

function InlineField({
  label, value, placeholder, onSave, type = "text",
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onSave: (v: string | null) => void;
  type?: "text" | "email" | "tel" | "number" | "url" | "date";
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setInput(value ?? ""); }, [value, editing]);

  function save() {
    setEditing(false);
    const trimmed = input.trim();
    onSave(trimmed === "" ? null : trimmed);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      {editing ? (
        <input
          ref={ref}
          type={type}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setInput(value ?? ""); setEditing(false); }
          }}
          className="text-sm bg-background border border-primary/50 rounded-lg px-2 py-1 outline-none focus:border-primary transition-colors"
          placeholder={placeholder}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group/f text-sm text-left flex items-center gap-1.5"
        >
          <span className={value ? "text-foreground" : "text-muted-foreground/40 italic"}>
            {value ?? placeholder ?? "—"}
          </span>
          <Pencil
            size={10}
            className="opacity-0 group-hover/f:opacity-50 transition-opacity text-muted-foreground shrink-0"
          />
        </button>
      )}
    </div>
  );
}

// ─── InlineSelect ─────────────────────────────────────────────────────────────

function InlineSelect({
  label, value, options, onSave,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className="flex flex-col gap-0.5 relative">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-left flex items-center gap-1 hover:text-foreground/80 transition-colors"
      >
        <span className={current ? "text-foreground" : "text-muted-foreground/40 italic"}>
          {current?.label ?? "—"}
        </span>
        <ChevronDown size={10} className="text-muted-foreground shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-36">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => { setOpen(false); onSave(o.value); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                  value === o.value ? "font-medium text-primary" : ""
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── StatusDropdown ───────────────────────────────────────────────────────────

function StatusDropdown({
  value, onChange,
}: {
  value: ProspectStatus;
  onChange: (s: ProspectStatus) => void;
}) {
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
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-44">
            {(Object.keys(STATUS_LABELS) as ProspectStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => { setOpen(false); onChange(s); }}
                className={`w-full text-left px-4 py-1.5 text-sm hover:bg-muted transition-colors ${
                  s === value ? "font-medium text-primary" : ""
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── AutoTextarea ─────────────────────────────────────────────────────────────

function AutoTextarea({
  value, placeholder, onSave,
}: {
  value: string | null;
  placeholder?: string;
  onSave: (v: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (document.activeElement !== ref.current) setText(value ?? "");
  }, [value]);

  function resize() {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }

  useEffect(() => { resize(); }, [text]);

  function handleBlur() {
    onSave(text.trim() || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => { setText(e.target.value); resize(); }}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={3}
        className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2.5 resize-none outline-none focus:border-primary/40 focus:bg-background transition-all placeholder:text-muted-foreground/35 leading-relaxed"
      />
      {saved && (
        <span className="absolute bottom-2.5 right-3 text-[10px] text-emerald-400 pointer-events-none animate-in fade-in duration-150">
          Sauvegardé
        </span>
      )}
    </div>
  );
}

// ─── Timeline entry ───────────────────────────────────────────────────────────

type TimelineItem =
  | { kind: "email"; id: string; date: string; direction: "SENT" | "RECEIVED"; subject: string; body: string; aiAnalysis: string | null };

function TimelineEntry({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);

  if (item.kind === "email") {
    return (
      <div className="relative pl-8">
        <div className="absolute left-0 top-1 size-6 rounded-full bg-blue-500/15 border border-blue-400/30 flex items-center justify-center shrink-0">
          {item.direction === "SENT"
            ? <Send size={11} className="text-blue-400" />
            : <Mail size={11} className="text-blue-400" />}
        </div>
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 hover:bg-muted/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.subject}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.direction === "SENT" ? "Envoyé" : "Reçu"} · {fmtDatetime(item.date)}
              </p>
            </div>
            <ChevronDown
              size={13}
              className={`shrink-0 text-muted-foreground mt-0.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          {expanded && (
            <div className="border-t border-border px-3 py-2.5 space-y-2 animate-in fade-in duration-150">
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                {item.body}
              </pre>
              {item.aiAnalysis && (
                <p className="text-xs text-violet-300 bg-violet-500/10 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                  <Sparkles size={10} className="shrink-0 mt-0.5" />
                  {item.aiAnalysis}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProspectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string; insights?: string[] } | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSending, setDraftSending] = useState(false);
  const [draftSent, setDraftSent] = useState(false);
  const [draftWarning, setDraftWarning] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [newReminder, setNewReminder] = useState({ note: "", dueAt: "" });
  const [addingReminder, setAddingReminder] = useState(false);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [documents, setDocuments] = useState<ProspectDocumentRef[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch(`/api/prospects/${id}`).then((r) => r.json());
    setProspect(data);
    const [q, inv, docs] = await Promise.all([
      fetch(`/api/quotes?prospectId=${id}`).then((r) => r.json()),
      fetch(`/api/invoices?prospectId=${id}`).then((r) => r.json()),
      fetch(`/api/prospects/${id}/documents`).then((r) => r.json()),
    ]);
    setFinance({ quotes: q, invoices: inv });
    setDocuments(docs);
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const patchProspect = useCallback(
    async (data: Partial<Prospect>) => {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      setProspect((p) => (p ? { ...p, ...updated } : p));
      await load();
    },
    [id, load]
  );

  async function generateDraft() {
    setDraftLoading(true);
    setEmailDraft(null);
    setDraftSent(false);
    setDraftWarning(null);
    const data = await fetch("/api/ai/draft-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId: id }),
    }).then((r) => r.json());
    setEmailDraft({ subject: data.subject ?? "", body: data.body ?? "", insights: data.insights });
    setDraftLoading(false);
  }

  async function sendDraft(force = false) {
    if (!emailDraft) return;
    setDraftSending(true);
    setDraftWarning(null);
    const res = await fetch(`/api/prospects/${id}/emails/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: emailDraft.subject, body: emailDraft.body, force }),
    });
    if (res.status === 422) {
      const data = await res.json().catch(() => ({}));
      if (data.warning) { setDraftWarning(data.warning); setDraftSending(false); return; }
    }
    if (!res.ok) { setDraftSending(false); return; }
    setDraftSent(true);
    await load();
    setTimeout(() => { setEmailDraft(null); setDraftSent(false); }, 2000);
    setDraftSending(false);
  }

  async function scoreProspect() {
    setScoring(true);
    await Promise.all([
      fetch("/api/ai/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: id }),
      }),
      fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: id }),
      }),
    ]);
    await load();
    setScoring(false);
  }

  async function addReminder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newReminder.note.trim() || !newReminder.dueAt) return;
    setAddingReminder(true);
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId: id, ...newReminder, type: "CUSTOM" }),
    });
    await load();
    setNewReminder({ note: "", dueAt: "" });
    setAddingReminder(false);
    setShowReminderForm(false);
  }

  async function doneReminder(reminderId: string) {
    await fetch(`/api/reminders/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    await load();
  }

  async function uploadDocument(file: File) {
    setUploadingDoc(true);
    const form = new FormData();
    form.append("file", file);
    await fetch(`/api/prospects/${id}/documents`, { method: "POST", body: form });
    await load();
    setUploadingDoc(false);
  }

  async function deleteDocument(docId: string) {
    await fetch(`/api/prospect-documents/${docId}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  async function deleteProspect() {
    setDeleting(true);
    await fetch(`/api/prospects/${id}`, { method: "DELETE" });
    router.push("/crm");
  }

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={22} />
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Prospect introuvable.
      </div>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const timeline: TimelineItem[] = [
    ...prospect.emails.map((e): TimelineItem => ({
      kind: "email",
      id: e.id,
      date: e.sentAt,
      direction: e.direction,
      subject: e.subject,
      body: e.body,
      aiAnalysis: e.aiAnalysis,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const pendingReminders = prospect.reminders.filter((r) => r.status === "PENDING");
  const availableTags = NEED_TYPES.filter((t) => !prospect.needType.includes(t));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
          <button
            onClick={() => router.push("/crm")}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Avatar */}
          <div className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {initials(prospect.name)}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate">{prospect.name}</h1>
            {prospect.company && (
              <p className="text-xs text-muted-foreground truncate">{prospect.company}</p>
            )}
          </div>

          {/* Score */}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scoreColor(prospect.score)}`}>
            {prospect.score !== null ? `${prospect.score}/10` : "—"}
          </span>

          {/* Status */}
          <StatusDropdown
            value={prospect.status}
            onChange={(s) => patchProspect({ status: s })}
          />

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Supprimer ?</span>
              <button
                onClick={deleteProspect}
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
              className="text-muted-foreground hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
            >
              <Trash2 size={14} />
            </button>
          )}
        </header>

        {/* ── 3-column body ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-[260px_1fr_260px] flex-1 overflow-hidden divide-x divide-border">

          {/* ── LEFT : infos contact ──────────────────────────────────────── */}
          <aside className="overflow-y-auto p-4 space-y-6">

            <Section title="Contact">
              <InlineField
                label="Nom"
                value={prospect.name}
                onSave={(v) => patchProspect({ name: v ?? "" })}
              />
              <InlineField
                label="Email"
                value={prospect.email}
                type="email"
                onSave={(v) => patchProspect({ email: v ?? "" })}
              />
              <InlineField
                label="Entreprise"
                value={prospect.company}
                placeholder="Non renseigné"
                onSave={(v) => patchProspect({ company: v })}
              />
              <InlineField
                label="Téléphone"
                value={prospect.phone}
                type="tel"
                placeholder="Non renseigné"
                onSave={(v) => patchProspect({ phone: v })}
              />
              <InlineSelect
                label="Source"
                value={prospect.source}
                options={SOURCES.map((s) => ({ value: s, label: s }))}
                onSave={(v) => patchProspect({ source: v })}
              />
            </Section>

            <Section title="Liens">
              <InlineField
                label="Site web"
                value={prospect.websiteUrl}
                type="url"
                placeholder="https://…"
                onSave={(v) => patchProspect({ websiteUrl: v })}
              />
              <InlineField
                label="LinkedIn / Facebook"
                value={prospect.linkedinUrl}
                type="url"
                placeholder="https://…"
                onSave={(v) => patchProspect({ linkedinUrl: v })}
              />
            </Section>

          </aside>

          {/* ── CENTER : description + analyse IA + timeline ─────────────── */}
          <main className="overflow-y-auto p-4 space-y-6">

            <Section title="Description entreprise">
              <AutoTextarea
                value={prospect.companyDescription}
                placeholder="Notes libres sur l'entreprise, contexte, observations, pain points…"
                onSave={(v) => patchProspect({ companyDescription: v })}
              />
            </Section>

            <Section title="Brief / Notes projet">
              <AutoTextarea
                value={prospect.prospectNotes}
                placeholder="Informations complémentaires à transmettre à l'IA : cahier des charges oral, contraintes techniques, préférences client, points importants non capturés par email…"
                onSave={(v) => patchProspect({ prospectNotes: v })}
              />
            </Section>

            <Section title={`Documents${documents.length > 0 ? ` · ${documents.length}` : ""}`}>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2.5 px-3 py-2 bg-muted/30 border border-border rounded-xl group/doc">
                    <FileText size={13} className="shrink-0 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">{doc.filename}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {doc.mimeType === "application/pdf" ? "PDF" : "Image"}
                    </span>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="opacity-0 group-hover/doc:opacity-100 p-0.5 text-muted-foreground hover:text-red-400 transition-all shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                <label className={`flex items-center gap-2 w-full text-sm border border-dashed border-border/60 rounded-xl px-3 py-2 transition-colors cursor-pointer ${uploadingDoc ? "opacity-50 pointer-events-none" : "text-muted-foreground/50 hover:text-foreground hover:border-border"}`}>
                  {uploadingDoc
                    ? <Loader2 size={13} className="animate-spin shrink-0" />
                    : <Paperclip size={13} className="shrink-0" />}
                  {uploadingDoc ? "Chargement…" : "Ajouter un document (PDF, image)"}
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDocument(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </Section>

            {(prospect.aiSummary || prospect.aiScoreReason || prospect.aiRecommendedAction || prospect.aiTags?.length > 0) && (
              <Section title="Analyse IA">
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-3">
                  {prospect.aiSummary && (
                    <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
                      {prospect.aiSummary}
                    </p>
                  )}
                  {prospect.aiScoreReason && (
                    <p className="text-xs text-muted-foreground border-t border-violet-500/15 pt-2.5 leading-relaxed">
                      {prospect.aiScoreReason}
                    </p>
                  )}
                  {prospect.aiRecommendedAction && (
                    <p className="text-xs text-emerald-300/90 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-2.5 py-2 leading-relaxed">
                      → {prospect.aiRecommendedAction}
                    </p>
                  )}
                  {prospect.aiTags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {prospect.aiTags.map((tag) => (
                        <span key={tag} className="text-[10px] bg-muted/50 border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {(draftLoading || emailDraft) && (
              <Section title="Email — brouillon Claude">
                {draftLoading ? (
                  <div className="flex items-center gap-2.5 py-6 text-muted-foreground text-sm">
                    <Loader2 size={15} className="animate-spin text-violet-400" />
                    Rédaction en cours…
                  </div>
                ) : emailDraft && (
                  <div className="space-y-3">
                    {emailDraft.insights && emailDraft.insights.length > 0 && (
                      <div className="bg-muted/40 rounded-xl px-3 py-2.5 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Observations utilisées</p>
                        {emailDraft.insights.map((insight, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-blue-400 shrink-0">·</span>{insight}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Objet</label>
                      <input
                        value={emailDraft.subject}
                        onChange={(e) => setEmailDraft((d) => d ? { ...d, subject: e.target.value } : d)}
                        className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Corps</label>
                      <textarea
                        value={emailDraft.body}
                        onChange={(e) => setEmailDraft((d) => d ? { ...d, body: e.target.value } : d)}
                        rows={12}
                        className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2.5 resize-none outline-none focus:border-primary/40 transition-colors leading-relaxed font-sans"
                      />
                    </div>
                    {draftWarning && (
                      <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-400/20 rounded-xl px-3 py-2">
                        {draftWarning}
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      {draftSent ? (
                        <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                          <Check size={11} /> Envoyé !
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => sendDraft(!!draftWarning)}
                            disabled={draftSending}
                            className="flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/20 px-3 py-1.5 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
                          >
                            {draftSending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                            {draftWarning ? "Envoyer quand même" : "Envoyer"}
                          </button>
                          <button
                            onClick={() => setEmailDraft(null)}
                            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </Section>
            )}

            <Section title={`Timeline · ${timeline.length} événement${timeline.length !== 1 ? "s" : ""}`}>
              {timeline.length > 0 ? (
                <div className="space-y-3">
                  {timeline.map((item) => (
                    <TimelineEntry key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/35 text-center py-8">
                  Aucune activité pour l'instant.
                </p>
              )}
            </Section>

          </main>

          {/* ── RIGHT : actions, rappels, budget, tags ────────────────────── */}
          <aside className="overflow-y-auto p-4 space-y-6">

            <Section title="Actions rapides">
              <button
                onClick={scoreProspect}
                disabled={scoring}
                className="w-full flex items-center justify-center gap-2 text-sm bg-violet-500/12 text-violet-300 border border-violet-500/20 px-3 py-2 rounded-xl hover:bg-violet-500/20 disabled:opacity-50 transition-all"
              >
                {scoring ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {scoring ? "Scoring…" : "Scorer IA"}
              </button>
              <button
                onClick={generateDraft}
                disabled={draftLoading}
                className="w-full flex items-center justify-center gap-2 text-sm bg-blue-500/12 text-blue-300 border border-blue-500/20 px-3 py-2 rounded-xl hover:bg-blue-500/20 disabled:opacity-50 transition-all"
              >
                {draftLoading ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                {draftLoading ? "Rédaction…" : emailDraft ? "Régénérer" : "Générer email"}
              </button>
              {["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(prospect.status) && (
                <button
                  onClick={() => router.push(`/finance`)}
                  className="w-full flex items-center justify-center gap-2 text-sm bg-emerald-500/12 text-emerald-300 border border-emerald-500/20 px-3 py-2 rounded-xl hover:bg-emerald-500/20 transition-all"
                >
                  <FileText size={13} />
                  Créer un devis
                </button>
              )}
              {prospect.status === "WON" && (
                <button
                  onClick={async () => {
                    setCreatingProject(true);
                    const res = await fetch("/api/projects", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ prospectId: id, name: `Projet — ${prospect.company ?? prospect.name}` }),
                    });
                    const project = await res.json();
                    router.push(`/projets/${project.id}`);
                  }}
                  disabled={creatingProject}
                  className="w-full flex items-center justify-center gap-2 text-sm bg-violet-500/12 text-violet-300 border border-violet-500/20 px-3 py-2 rounded-xl hover:bg-violet-500/20 disabled:opacity-50 transition-all"
                >
                  {creatingProject ? <Loader2 size={13} className="animate-spin" /> : <FolderKanban size={13} />}
                  Créer un projet
                </button>
              )}
            </Section>

            {finance && (finance.quotes.length > 0 || finance.invoices.length > 0) && (
              <Section title="Finance">
                <div className="space-y-1.5">
                  {finance.quotes.map((q) => (
                    <div key={q.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-2.5 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText size={10} className="text-blue-400 shrink-0" />
                        <span className="text-muted-foreground font-mono truncate">{q.number}</span>
                      </div>
                      <span className="font-medium shrink-0">{q.totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €</span>
                    </div>
                  ))}
                  {finance.invoices.map((inv) => (
                    <div key={inv.id} className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-2 ${inv.status === "PAID" ? "bg-emerald-500/8" : inv.status === "OVERDUE" ? "bg-red-500/8" : "bg-muted/30"}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Receipt size={10} className={inv.status === "PAID" ? "text-emerald-400 shrink-0" : inv.status === "OVERDUE" ? "text-red-400 shrink-0" : "text-amber-400 shrink-0"} />
                        <span className="text-muted-foreground font-mono truncate">{inv.number}</span>
                      </div>
                      <span className="font-medium shrink-0">{inv.totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push("/finance")}
                  className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground border border-dashed border-border/60 rounded-xl py-1.5 hover:border-border transition-colors"
                >
                  Voir dans Finance →
                </button>
              </Section>
            )}

            <Section title="Prochaine action">
              <InlineField
                label="Note"
                value={prospect.nextActionNote}
                placeholder="Que faire ?"
                onSave={(v) => patchProspect({ nextActionNote: v })}
              />
              <InlineField
                label="Date"
                value={
                  prospect.nextActionAt
                    ? new Date(prospect.nextActionAt).toISOString().slice(0, 10)
                    : null
                }
                type="date"
                onSave={(v) =>
                  patchProspect({ nextActionAt: v ? new Date(v).toISOString() : null })
                }
              />
            </Section>

            <Section title="Budget">
              <InlineField
                label="Estimé (€)"
                value={prospect.estimatedBudget !== null ? String(prospect.estimatedBudget) : null}
                type="number"
                placeholder="ex: 5000"
                onSave={(v) =>
                  patchProspect({ estimatedBudget: v ? parseFloat(v) : null })
                }
              />
            </Section>

            <Section title="Besoins">
              <div className="flex flex-wrap gap-1.5">
                {prospect.needType.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-xs bg-muted/60 border border-border rounded-full px-2.5 py-1"
                  >
                    {tag}
                    <button
                      onClick={() =>
                        patchProspect({ needType: prospect.needType.filter((t) => t !== tag) })
                      }
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      patchProspect({ needType: [...prospect.needType, tag] })
                    }
                    className="text-xs text-muted-foreground/40 border border-dashed border-border/60 rounded-full px-2.5 py-1 hover:text-foreground hover:border-border transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </Section>

            <Section
              title={`Rappels${pendingReminders.length > 0 ? ` · ${pendingReminders.length}` : ""}`}
            >
              <div className="space-y-2">
                {pendingReminders.length === 0 && !showReminderForm && (
                  <p className="text-xs text-muted-foreground/35">Aucun rappel en attente.</p>
                )}

                {pendingReminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-2 bg-amber-500/5 border border-amber-400/20 rounded-xl px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-amber-300/90 leading-snug">{r.note}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(r.dueAt)}</p>
                    </div>
                    <button
                      onClick={() => doneReminder(r.id)}
                      className="p-1 rounded-lg hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-400 transition-colors shrink-0 mt-0.5"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ))}

                {showReminderForm ? (
                  <form onSubmit={addReminder} className="flex flex-col gap-2 pt-1">
                    <input
                      value={newReminder.note}
                      onChange={(e) =>
                        setNewReminder((r) => ({ ...r, note: e.target.value }))
                      }
                      placeholder="Note du rappel…"
                      className="text-xs bg-muted/30 border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
                    />
                    <input
                      type="date"
                      value={newReminder.dueAt}
                      onChange={(e) =>
                        setNewReminder((r) => ({ ...r, dueAt: e.target.value }))
                      }
                      className="text-xs bg-muted/30 border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/40 transition-colors"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={
                          addingReminder ||
                          !newReminder.note.trim() ||
                          !newReminder.dueAt
                        }
                        className="flex-1 text-xs bg-primary text-primary-foreground px-2.5 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
                      >
                        {addingReminder ? (
                          <Loader2 size={11} className="animate-spin mx-auto" />
                        ) : (
                          "Ajouter"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReminderForm(false)}
                        className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowReminderForm(true)}
                    className="w-full text-xs text-muted-foreground/40 border border-dashed border-border/60 rounded-xl py-2 hover:text-foreground hover:border-border transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={10} />
                    Ajouter un rappel
                  </button>
                )}
              </div>
            </Section>

          </aside>

        </div>
      </div>
    </>
  );
}
