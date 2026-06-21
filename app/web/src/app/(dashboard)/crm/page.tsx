"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, X, Archive, Upload, CheckSquare, Square, ChevronRight } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProspectStatus =
  | "NEW" | "SCORING" | "SCORED" | "VIP"
  | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT"
  | "NEGOTIATION" | "WON" | "LOST" | "ARCHIVED";

type Prospect = {
  id: string;
  name: string;
  company: string | null;
  status: ProspectStatus;
  score: number | null;
  lastContactedAt: string | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
};

type NewProspectForm = {
  name: string;
  email: string;
  company: string;
  phone: string;
  websiteUrl: string;
  linkedinUrl: string;
  source: string;
  needType: string[];
  estimatedBudget: string;
  nextActionNote: string;
  nextActionAt: string;
};

const EMPTY_FORM: NewProspectForm = {
  name: "", email: "", company: "", phone: "",
  websiteUrl: "", linkedinUrl: "", source: "",
  needType: [], estimatedBudget: "", nextActionNote: "", nextActionAt: "",
};

const SOURCES = ["LinkedIn", "Référence", "GitHub", "Site web", "Réseau", "Autre"];
const NEED_TYPES = [
  { value: "webapp", label: "Web App" },
  { value: "site", label: "Site vitrine" },
  { value: "consulting", label: "Consulting" },
  { value: "api", label: "API / Backend" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "mobile", label: "Application mobile" },
];

// ─── Kanban config ────────────────────────────────────────────────────────────

type Column = { status: ProspectStatus; label: string; color: string; badge?: string };

const PROSPECTION_COLUMNS: Column[] = [
  { status: "SCORED", label: "File 9h", color: "border-sky-400", badge: "auto" },
  { status: "VIP", label: "VIP", color: "border-violet-400", badge: "★" },
];

const VENTE_COLUMNS: Column[] = [
  { status: "CONTACTED", label: "Contacté", color: "border-blue-400" },
  { status: "QUALIFIED", label: "Qualifié", color: "border-teal-400" },
  { status: "PROPOSAL_SENT", label: "Devis envoyé", color: "border-amber-400" },
  { status: "NEGOTIATION", label: "Négociation", color: "border-orange-400" },
  { status: "WON", label: "Signé", color: "border-emerald-400", badge: "✓" },
];

const LOST_COLUMNS: Column[] = [
  { status: "LOST", label: "Perdu", color: "border-red-400" },
  { status: "ARCHIVED", label: "Archivé", color: "border-zinc-500" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 8) return "bg-violet-500/20 text-violet-400";
  if (score >= 4) return "bg-sky-500/20 text-sky-400";
  return "bg-red-500/20 text-red-400";
}

function daysAgo(date: string | null) {
  if (!date) return null;
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  return `il y a ${diff}j`;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").toUpperCase().slice(0, 2) || "?";
}

// ─── Prospect Card ────────────────────────────────────────────────────────────

function ProspectCard({ prospect }: { prospect: Prospect }) {
  const isVip = prospect.status === "VIP";
  return (
    <Link
      href={`/crm/${prospect.id}`}
      className={`block rounded-lg border p-3 transition-colors hover:border-primary/50 ${
        isVip
          ? "border-violet-500/40 bg-violet-950/20"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${
          isVip ? "bg-violet-500/20 text-violet-300" : "bg-primary/10 text-primary"
        }`}>
          {initials(prospect.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{prospect.name}</p>
          {prospect.company && <p className="text-xs text-muted-foreground truncate">{prospect.company}</p>}
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${scoreColor(prospect.score)}`}>
          {prospect.score ?? "—"}
        </span>
      </div>
      {prospect.lastContactedAt && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Dernier contact : {daysAgo(prospect.lastContactedAt)}
        </p>
      )}
      {prospect.nextActionNote && (
        <div className="mt-1.5 text-[11px] bg-muted/50 rounded px-2 py-1 truncate text-muted-foreground">
          ↪ {prospect.nextActionNote}
          {prospect.nextActionAt && (
            <span className="ml-1 text-primary/70">
              · {new Date(prospect.nextActionAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ col, prospects }: { col: Column; prospects: Prospect[] }) {
  return (
    <div className="flex flex-col min-w-0">
      <div className={`flex items-center justify-between mb-2 pb-2 border-b-2 ${col.color}`}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          {col.label}
          {col.badge && (
            <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
              col.badge === "★" ? "bg-violet-500/20 text-violet-400" :
              col.badge === "✓" ? "bg-emerald-500/20 text-emerald-400" :
              "bg-sky-500/20 text-sky-400"
            }`}>{col.badge}</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {prospects.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto flex-1">
        {prospects.map((p) => <ProspectCard key={p.id} prospect={p} />)}
        {prospects.length === 0 && (
          <p className="text-[11px] text-muted-foreground/40 text-center pt-4">Vide</p>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Group Header ──────────────────────────────────────────────────────

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="col-span-full flex items-center gap-3 mb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</span>
      <span className="text-[10px] text-muted-foreground/40">{count}</span>
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

type CsvRow = {
  name: string;
  company: string;
  email: string;
  phone: string;
  websiteUrl: string;
  linkedinUrl: string;
  source: string;
  selected: boolean;
};

function parseCsvText(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";

  function splitLine(line: string): string[] {
    if (sep === ";") return line.split(";").map((f) => f.trim().replace(/^"|"$/g, ""));
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));

  function col(...aliases: string[]): number {
    for (const a of aliases) {
      const i = headers.findIndex((h) => h.includes(a));
      if (i !== -1) return i;
    }
    return -1;
  }

  const idx = {
    name: col("nom", "name", "prenom", "contact", "firstname", "lastname"),
    company: col("entreprise", "company", "societe", "organisation", "org"),
    email: col("email", "courriel", "mail"),
    phone: col("telephone", "phone", "tel", "mobile", "portable"),
    websiteUrl: col("website", "site", "url", "web"),
    linkedinUrl: col("linkedin"),
    source: col("source", "origine"),
  };

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = splitLine(lines[i]);
    const g = (k: keyof typeof idx) => (idx[k] !== -1 && f[idx[k]] ? f[idx[k]].trim() : "");
    if (!g("name") && !g("email")) continue;
    rows.push({ name: g("name"), company: g("company"), email: g("email"), phone: g("phone"), websiteUrl: g("websiteUrl"), linkedinUrl: g("linkedinUrl"), source: g("source"), selected: true });
  }
  return rows;
}

function CsvImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setParseError("Seuls les fichiers .csv sont acceptés.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsvText(text);
      if (parsed.length === 0) {
        setParseError("Aucune ligne valide trouvée. Vérifiez le format du CSV.");
        return;
      }
      setParseError(null);
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
  }

  function toggleAll(val: boolean) {
    setRows((r) => r.map((row) => ({ ...row, selected: val })));
  }

  function toggleRow(i: number) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, selected: !row.selected } : row));
  }

  async function startImport() {
    const selected = rows.filter((r) => r.selected);
    setProgress({ done: 0, total: selected.length, errors: 0 });
    setStep("importing");

    let errors = 0;
    for (let i = 0; i < selected.length; i++) {
      const row = selected[i];
      try {
        const res = await fetch("/api/prospects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name || row.company || row.email,
            email: row.email,
            company: row.company || null,
            phone: row.phone || null,
            websiteUrl: row.websiteUrl || null,
            linkedinUrl: row.linkedinUrl || null,
            source: row.source || "CSV",
          }),
        });
        if (!res.ok) errors++;
      } catch {
        errors++;
      }
      setProgress({ done: i + 1, total: selected.length, errors });
    }
    setStep("done");
    setProgress((p) => ({ ...p, errors }));
  }

  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">Importer des prospects depuis un CSV</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Colonnes reconnues : nom, email, entreprise, telephone, website, linkedin, source
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* Step : upload */}
          {step === "upload" && (
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                <Upload size={28} />
                <span className="text-sm">Cliquer pour choisir un fichier .csv</span>
                <span className="text-xs text-muted-foreground/60">Séparateur virgule ou point-virgule · UTF-8</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
              {parseError && <p className="text-xs text-red-400">{parseError}</p>}
              <a
                href="data:text/csv;charset=utf-8,nom,email,entreprise,telephone,website,linkedin,source%0AJean Dupont,jean@acme.fr,Acme SAS,0612345678,https://acme.fr,,LinkedIn"
                download="modele-import.csv"
                className="text-xs text-primary/70 hover:text-primary underline"
              >
                Télécharger le modèle CSV
              </a>
            </div>
          )}

          {/* Step : preview */}
          {step === "preview" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{rows.length} ligne{rows.length > 1 ? "s" : ""} détectée{rows.length > 1 ? "s" : ""}</span>
                <button
                  type="button"
                  onClick={() => toggleAll(!allSelected)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="w-8 px-3 py-2" />
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nom</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Entreprise</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        onClick={() => toggleRow(i)}
                        className={`border-t border-border cursor-pointer transition-colors ${row.selected ? "bg-background hover:bg-muted/20" : "bg-muted/10 opacity-50"}`}
                      >
                        <td className="px-3 py-2">
                          {row.selected ? <CheckSquare size={13} className="text-primary" /> : <Square size={13} className="text-muted-foreground" />}
                        </td>
                        <td className="px-3 py-2 max-w-[120px] truncate">{row.name || <span className="text-muted-foreground/40">—</span>}</td>
                        <td className="px-3 py-2 max-w-[120px] truncate">{row.company || <span className="text-muted-foreground/40">—</span>}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate">{row.email || <span className="text-muted-foreground/40">—</span>}</td>
                        <td className="px-3 py-2">{row.source || <span className="text-muted-foreground/40">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step : importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm font-medium">Import en cours…</p>
              <p className="text-xs text-muted-foreground">{progress.done} / {progress.total} prospects créés</p>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground/60">Claude score chaque prospect en arrière-plan</p>
            </div>
          )}

          {/* Step : done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <ChevronRight size={22} className="text-emerald-400" />
              </div>
              <p className="text-sm font-medium">Import terminé</p>
              <p className="text-xs text-muted-foreground">
                {progress.done - progress.errors} prospect{progress.done - progress.errors > 1 ? "s" : ""} créé{progress.done - progress.errors > 1 ? "s" : ""}
                {progress.errors > 0 && <span className="text-amber-400 ml-2">· {progress.errors} ignoré{progress.errors > 1 ? "s" : ""} (doublons ou erreurs)</span>}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          {step !== "importing" && (
            <button type="button" onClick={step === "done" ? () => { onDone(); onClose(); } : onClose}
              className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg transition-colors">
              {step === "done" ? "Fermer" : "Annuler"}
            </button>
          )}
          {step === "preview" && (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={startImport}
              className="flex items-center gap-2 text-sm bg-primary text-primary-foreground px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium transition-colors"
            >
              <Upload size={14} />
              Importer {selectedCount} prospect{selectedCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function NewProspectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Prospect) => void;
}) {
  const [form, setForm] = useState<NewProspectForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof NewProspectForm, string>>>({});

  function set(field: keyof NewProspectForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function toggleNeed(value: string) {
    setForm((f) => ({
      ...f,
      needType: f.needType.includes(value)
        ? f.needType.filter((v) => v !== value)
        : [...f.needType, value],
    }));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Requis";
    if (!form.email.trim()) errs.email = "Requis";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim() || null,
          phone: form.phone.trim() || null,
          websiteUrl: form.websiteUrl.trim() || null,
          linkedinUrl: form.linkedinUrl.trim() || null,
          source: form.source || null,
          needType: form.needType,
          estimatedBudget: form.estimatedBudget ? parseFloat(form.estimatedBudget) : null,
          nextActionNote: form.nextActionNote.trim() || null,
          nextActionAt: form.nextActionAt || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error ?? "Une erreur est survenue.");
        setSaving(false);
        return;
      }
      const created = await res.json();
      onCreated(created);
    } catch (err) {
      console.error("fetch error:", err);
    }
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">Nouveau prospect</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Claude score automatiquement à la création
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Scoring overlay */}
        {saving && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/90 rounded-2xl gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm font-medium">Scoring en cours…</p>
            <p className="text-xs text-muted-foreground">Claude analyse le prospect</p>
          </div>
        )}

        {/* Scrollable body */}
        <form onSubmit={submit} className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">

          {/* Section Contact */}
          <section className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom *" error={errors.name}>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)}
                  placeholder="Jean Dupont" className={input(errors.name)} />
              </Field>
              <Field label="Entreprise">
                <input value={form.company} onChange={(e) => set("company", e.target.value)}
                  placeholder="Acme SAS" className={input()} />
              </Field>
              <Field label="Email *" error={errors.email}>
                <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                  placeholder="jean@acme.fr" className={input(errors.email)} />
              </Field>
              <Field label="Téléphone">
                <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)}
                  placeholder="06 12 34 56 78" className={input()} />
              </Field>
            </div>
          </section>

          {/* Section Présence en ligne */}
          <section className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Présence en ligne
              <span className="ml-2 normal-case font-normal text-violet-400/80">améliore la précision du scoring</span>
            </p>
            <Field label="Site web">
              <input type="url" value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)}
                placeholder="https://acme.fr" className={input()} />
            </Field>
            <Field label="LinkedIn ou page Facebook">
              <input type="url" value={form.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/... ou facebook.com/..." className={input()} />
            </Field>
          </section>

          {/* Section Contexte */}
          <section className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Contexte</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Source">
                <select value={form.source} onChange={(e) => set("source", e.target.value)} className={input()}>
                  <option value="">— Choisir</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Budget estimé (€)">
                <input type="number" min={0} value={form.estimatedBudget}
                  onChange={(e) => set("estimatedBudget", e.target.value)}
                  placeholder="5000" className={input()} />
              </Field>
            </div>

            <Field label="Besoin(s)">
              <div className="flex flex-wrap gap-2 mt-1">
                {NEED_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleNeed(value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.needType.includes(value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </section>

          {/* Section Prochaine action */}
          <section className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Prochaine action</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Note">
                <input value={form.nextActionNote} onChange={(e) => set("nextActionNote", e.target.value)}
                  placeholder="Appel de qualification" className={input()} />
              </Field>
              <Field label="Date">
                <input type="date" value={form.nextActionAt} onChange={(e) => set("nextActionAt", e.target.value)}
                  className={input()} />
              </Field>
            </div>
          </section>

          {/* Footer */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border sticky bottom-0 bg-card pb-1">
            {apiError && (
              <p className="text-xs text-red-400 text-center">{apiError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose}
                className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 text-sm bg-primary text-primary-foreground px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium transition-colors">
                {saving ? "Scoring en cours…" : "Créer le prospect"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function input(error?: string) {
  return `w-full border rounded-lg px-3 py-2 text-sm bg-background transition-colors focus:outline-none focus:ring-1 ${
    error ? "border-red-500 focus:ring-red-500" : "border-border focus:ring-primary"
  }`;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch("/api/prospects").then((r) => r.json());
    setProspects(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Auto-poll tant que des prospects sont en cours de scoring
  useEffect(() => {
    const hasScoring = prospects.some((p) => p.status === "SCORING" || p.status === "NEW");
    if (!hasScoring) return;
    const timer = setTimeout(() => load(), 3000);
    return () => clearTimeout(timer);
  }, [prospects, load]);

  function handleCreated(p: Prospect) {
    setProspects((prev) => [p, ...prev]);
    setShowModal(false);
    load();
  }

  const byStatus = (status: ProspectStatus) => prospects.filter((p) => p.status === status);

  const scoredCount = byStatus("SCORED").length;
  const vipCount = byStatus("VIP").length;
  const venteCount = ["CONTACTED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].reduce(
    (acc, s) => acc + byStatus(s as ProspectStatus).length, 0
  );
  const lostCount = prospects.filter(
    (p) => p.status === "LOST" || p.status === "ARCHIVED"
  ).length;

  const totalCols = PROSPECTION_COLUMNS.length + VENTE_COLUMNS.length;

  return (
    <>
      {showModal && (
        <NewProspectModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
      {showCsvModal && (
        <CsvImportModal onClose={() => setShowCsvModal(false)} onDone={load} />
      )}

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">CRM & Prospection</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              {scoredCount > 0 && <span className="text-sky-400">{scoredCount} en file</span>}
              {vipCount > 0 && <span className="text-violet-400">{vipCount} VIP</span>}
              {venteCount > 0 && <span>{venteCount} en vente</span>}
              {scoredCount === 0 && vipCount === 0 && venteCount === 0 && <span>Aucun prospect actif</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/crm/archives"
              prefetch={false}
              className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-2 rounded-lg hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Archive size={13} />
              Archivés{lostCount > 0 && <span className="ml-1 text-muted-foreground/60">{lostCount}</span>}
            </Link>
            <button
              onClick={() => setShowCsvModal(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-2 rounded-lg hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Upload size={13} />
              Importer CSV
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <Plus size={15} />
              Nouveau prospect
            </button>
          </div>
        </div>

        {/* Kanban */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden p-4">
            <div
              className="grid gap-2 h-full"
              style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
            >
              {/* Groupe Prospection */}
              <GroupHeader label="Prospection" count={scoredCount + vipCount} />
              {PROSPECTION_COLUMNS.map((col) => (
                <KanbanColumn key={col.status} col={col} prospects={byStatus(col.status)} />
              ))}

              <div className="col-span-full border-t border-border/30 my-1" />

              {/* Groupe Vente */}
              <GroupHeader label="Vente" count={venteCount} />
              {VENTE_COLUMNS.map((col) => (
                <KanbanColumn key={col.status} col={col} prospects={byStatus(col.status)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
