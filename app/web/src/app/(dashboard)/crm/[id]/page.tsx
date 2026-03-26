"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Sparkles, Mail, StickyNote,
  Bell, Pencil, Check, Globe, ExternalLink, Trash2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProspectStatus =
  | "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT"
  | "NEGOTIATION" | "WON" | "LOST" | "ARCHIVED";

const STATUS_LABELS: Record<ProspectStatus, string> = {
  NEW: "Nouveau", CONTACTED: "Contacté", QUALIFIED: "Qualifié",
  PROPOSAL_SENT: "Devis envoyé", NEGOTIATION: "Négociation",
  WON: "Signé", LOST: "Perdu", ARCHIVED: "Archivé",
};

const STATUS_COLORS: Record<ProspectStatus, string> = {
  NEW: "bg-slate-500/20 text-slate-300",
  CONTACTED: "bg-blue-500/20 text-blue-300",
  QUALIFIED: "bg-violet-500/20 text-violet-300",
  PROPOSAL_SENT: "bg-amber-500/20 text-amber-300",
  NEGOTIATION: "bg-orange-500/20 text-orange-300",
  WON: "bg-emerald-500/20 text-emerald-300",
  LOST: "bg-red-500/20 text-red-300",
  ARCHIVED: "bg-muted text-muted-foreground",
};

type Note = { id: string; createdAt: string; content: string; source: string | null };
type Reminder = {
  id: string; dueAt: string; note: string;
  status: "PENDING" | "DONE" | "SNOOZED"; type: string;
};
type Prospect = {
  id: string; name: string; company: string | null; email: string;
  phone: string | null; linkedinUrl: string | null; websiteUrl: string | null;
  status: ProspectStatus; score: number | null;
  needType: string[]; estimatedBudget: number | null; source: string | null;
  lastContactedAt: string | null; nextActionAt: string | null; nextActionNote: string | null;
  aiSummary: string | null; aiScoreReason: string | null;
  notes: Note[]; reminders: Reminder[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(s: number | null) {
  if (s === null) return "bg-muted text-muted-foreground";
  if (s >= 8) return "bg-emerald-500/20 text-emerald-400";
  if (s >= 5) return "bg-amber-500/20 text-amber-400";
  return "bg-red-500/20 text-red-400";
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function urlLabel(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h.length > 28 ? h.slice(0, 28) + "…" : h;
  } catch {
    return url.slice(0, 30);
  }
}

// ─── Editable inline field ────────────────────────────────────────────────────

function EditableUrl({
  label, value, icon: Icon, onSave,
}: {
  label: string;
  value: string | null;
  icon: React.ElementType;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value ?? "");

  function save() {
    setEditing(false);
    onSave(input.trim());
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      {editing ? (
        <div className="flex gap-1">
          <input
            autoFocus
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 border border-primary rounded-md px-2 py-0.5 text-sm bg-background"
            placeholder="https://..."
          />
          <button onClick={save} className="text-xs text-primary px-2 py-1 hover:bg-muted rounded">OK</button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 group">
          {value ? (
            <>
              <a
                href={value} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline truncate"
              >
                <Icon size={12} className="shrink-0" />
                {urlLabel(value)}
                <ExternalLink size={10} className="shrink-0 opacity-50" />
              </a>
            </>
          ) : (
            <span className="text-sm text-muted-foreground/50">Non renseigné</span>
          )}
          <button
            onClick={() => { setInput(value ?? ""); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          >
            <Pencil size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProspectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<{
    subject: string; body: string; insights?: string[]; scraped?: boolean;
  } | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/prospects/${id}`)
      .then((r) => r.json())
      .then(setProspect)
      .finally(() => setLoading(false));
  }, [id]);

  async function patchProspect(data: Partial<Prospect>) {
    const res = await fetch(`/api/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    setProspect((p) => p ? { ...p, ...updated } : p);
  }

  async function scoreProspect() {
    setScoring(true);
    const res = await fetch("/api/ai/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId: id }),
    });
    const updated = await res.json();
    setProspect((p) => p ? { ...p, score: updated.score, aiScoreReason: updated.aiScoreReason } : p);
    setScoring(false);
  }

  async function draftEmail() {
    setDrafting(true);
    setDraft(null);
    const res = await fetch("/api/ai/draft-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId: id }),
    });
    const data = await res.json();
    setDraft(data);
    setDrafting(false);
  }

  async function addNote(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setSavingNote(true);
    const res = await fetch(`/api/prospects/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteContent }),
    });
    const note = await res.json();
    setProspect((p) => p ? { ...p, notes: [note, ...p.notes] } : p);
    setNoteContent("");
    setSavingNote(false);
  }

  async function deleteProspect() {
    setDeleting(true);
    await fetch(`/api/prospects/${id}`, { method: "DELETE" });
    router.push("/crm");
  }

  async function doneReminder(reminderId: string) {
    await fetch(`/api/reminders/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    setProspect((p) =>
      p ? { ...p, reminders: p.reminders.map((r) => r.id === reminderId ? { ...r, status: "DONE" as const } : r) } : p
    );
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" size={24} />
    </div>
  );

  if (!prospect) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Prospect introuvable.
    </div>
  );

  const pendingReminders = prospect.reminders.filter((r) => r.status === "PENDING");
  const hasUrl = !!(prospect.websiteUrl || prospect.linkedinUrl);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <button onClick={() => router.push("/crm")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{prospect.name}</h1>
          {prospect.company && <p className="text-xs text-muted-foreground">{prospect.company}</p>}
        </div>
        <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${scoreColor(prospect.score)}`}>
          {prospect.score !== null ? `${prospect.score}/10` : "—"}
        </span>

        {/* Supprimer */}
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Supprimer ?</span>
            <button
              onClick={deleteProspect}
              disabled={deleting}
              className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 size={10} className="animate-spin" /> : null}
              Confirmer
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-muted-foreground hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
            title="Supprimer le prospect"
          >
            <Trash2 size={15} />
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setEditingStatus((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${STATUS_COLORS[prospect.status]}`}
          >
            {STATUS_LABELS[prospect.status]}
            <Pencil size={10} />
          </button>
          {editingStatus && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-card border border-border rounded-xl shadow-lg py-1 min-w-40">
              {(Object.keys(STATUS_LABELS) as ProspectStatus[]).map((s) => (
                <button key={s} onClick={() => { setEditingStatus(false); patchProspect({ status: s }); }}
                  className="w-full text-left px-4 py-1.5 text-sm hover:bg-muted">
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6 max-w-3xl w-full mx-auto">

        {/* Infos contact */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Email</p>
            <a href={`mailto:${prospect.email}`} className="text-sm text-primary hover:underline">{prospect.email}</a>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Téléphone</p>
            <p className="text-sm">{prospect.phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Source</p>
            <p className="text-sm">{prospect.source ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Budget estimé</p>
            <p className="text-sm">{prospect.estimatedBudget ? `${prospect.estimatedBudget.toLocaleString("fr-FR")} €` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Besoin</p>
            <p className="text-sm">{prospect.needType.join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Dernier contact</p>
            <p className="text-sm">{fmt(prospect.lastContactedAt)}</p>
          </div>

          {/* URLs éditables inline */}
          <EditableUrl
            label="Site web"
            value={prospect.websiteUrl}
            icon={Globe}
            onSave={(v) => patchProspect({ websiteUrl: v || null } as Partial<Prospect>)}
          />
          <EditableUrl
            label="LinkedIn / Facebook"
            value={prospect.linkedinUrl}
            icon={ExternalLink}
            onSave={(v) => patchProspect({ linkedinUrl: v || null } as Partial<Prospect>)}
          />
        </div>

        {/* IA */}
        <section className="border border-border rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles size={14} className="text-violet-400" />
              Analyse IA
            </h2>
            <div className="flex gap-2">
              <button
                onClick={scoreProspect}
                disabled={scoring}
                className="flex items-center gap-1.5 text-xs bg-violet-500/20 text-violet-300 px-3 py-1.5 rounded-lg hover:bg-violet-500/30 disabled:opacity-50 transition-colors"
              >
                {scoring && <Loader2 size={10} className="animate-spin" />}
                Scorer
              </button>
              <button
                onClick={draftEmail}
                disabled={drafting}
                className="flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
              >
                {drafting ? <Loader2 size={10} className="animate-spin" /> : <Mail size={10} />}
                {drafting ? "Analyse en cours…" : "Rédiger email"}
              </button>
            </div>
          </div>

          {/* Indicateur URL utilisée */}
          {hasUrl && (
            <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
              <Globe size={10} />
              Claude analysera {prospect.websiteUrl ? urlLabel(prospect.websiteUrl) : urlLabel(prospect.linkedinUrl!)} pour personnaliser l'email
            </p>
          )}
          {!hasUrl && (
            <p className="text-[11px] text-amber-400/70">
              ↑ Ajoute le site ou la page Facebook pour un email vraiment personnalisé
            </p>
          )}

          {prospect.aiScoreReason && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              {prospect.aiScoreReason}
            </p>
          )}
          {prospect.aiSummary ? (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{prospect.aiSummary}</p>
          ) : hasUrl ? (
            <p className="text-xs text-muted-foreground/50 flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin" />
              Analyse en cours — disponible dans quelques secondes
            </p>
          ) : null}
        </section>

        {/* Draft email */}
        {draft && (
          <section className="border border-blue-400/30 rounded-xl p-4 flex flex-col gap-3 bg-blue-500/5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
                Email rédigé par Claude
                {draft.scraped && (
                  <span className="ml-2 normal-case font-normal text-blue-400/70">· analyse présence en ligne</span>
                )}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(`Objet : ${draft.subject}\n\n${draft.body}`)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Copier
              </button>
            </div>

            {draft.insights && draft.insights.length > 0 && (
              <div className="bg-muted/30 rounded-lg px-3 py-2 flex flex-col gap-1">
                <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Observations</p>
                {draft.insights.map((insight, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-blue-400 shrink-0">·</span>{insight}
                  </p>
                ))}
              </div>
            )}

            <div className="border-t border-blue-400/20 pt-3 flex flex-col gap-2">
              <p className="text-xs font-medium text-foreground/70">Objet : {draft.subject}</p>
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">{draft.body}</pre>
            </div>
          </section>
        )}

        {/* Rappels */}
        {pendingReminders.length > 0 && (
          <section className="border border-amber-400/30 rounded-xl p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Bell size={14} className="text-amber-400" />
              Rappels ({pendingReminders.length})
            </h2>
            {pendingReminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{r.note}</span>
                  <span className="ml-2 text-xs text-amber-400">{fmt(r.dueAt)}</span>
                </div>
                <button onClick={() => doneReminder(r.id)}
                  className="p-1 rounded-lg hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-400 transition-colors">
                  <Check size={14} />
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Notes */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <StickyNote size={14} className="text-muted-foreground" />
            Notes ({prospect.notes.length})
          </h2>
          <form onSubmit={addNote} className="flex gap-2">
            <input
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="Ajouter une note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
            <button type="submit" disabled={savingNote || !noteContent.trim()}
              className="text-sm bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {savingNote ? <Loader2 size={14} className="animate-spin" /> : "Ajouter"}
            </button>
          </form>
          <div className="flex flex-col gap-2">
            {prospect.notes.map((note) => (
              <div key={note.id} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <p>{note.content}</p>
                <p className="text-xs text-muted-foreground mt-1">{fmt(note.createdAt)}</p>
              </div>
            ))}
            {prospect.notes.length === 0 && (
              <p className="text-xs text-muted-foreground/50">Aucune note.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
