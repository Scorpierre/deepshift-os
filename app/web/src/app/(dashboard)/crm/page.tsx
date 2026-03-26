"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProspectStatus =
  | "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT"
  | "NEGOTIATION" | "WON" | "LOST";

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

// ─── Kanban ───────────────────────────────────────────────────────────────────

const COLUMNS: { status: ProspectStatus; label: string; color: string }[] = [
  { status: "NEW", label: "Nouveau", color: "border-slate-400" },
  { status: "CONTACTED", label: "Contacté", color: "border-blue-400" },
  { status: "QUALIFIED", label: "Qualifié", color: "border-violet-400" },
  { status: "PROPOSAL_SENT", label: "Devis envoyé", color: "border-amber-400" },
  { status: "NEGOTIATION", label: "Négociation", color: "border-orange-400" },
  { status: "WON", label: "Signé ✓", color: "border-emerald-400" },
  { status: "LOST", label: "Perdu", color: "border-red-400" },
];

function scoreColor(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 8) return "bg-emerald-500/20 text-emerald-400";
  if (score >= 5) return "bg-amber-500/20 text-amber-400";
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
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function ProspectCard({ prospect }: { prospect: Prospect }) {
  return (
    <Link
      href={`/crm/${prospect.id}`}
      className="block rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold">
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
        <p className="mt-2 text-[11px] text-muted-foreground">Dernier contact : {daysAgo(prospect.lastContactedAt)}</p>
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

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Requis";
    if (!form.email.trim()) errs.email = "Requis";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
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
    const created = await res.json();
    onCreated(created);
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
            <p className="text-xs text-muted-foreground mt-0.5">Plus tu renseignes, plus l'email Claude sera précis</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={18} />
          </button>
        </div>

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
              <span className="ml-2 normal-case font-normal text-violet-400/80">utilisé par Claude pour personnaliser l'email</span>
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
                  {SOURCES.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}
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
                  placeholder="Envoyer email de présentation" className={input()} />
              </Field>
              <Field label="Date">
                <input type="date" value={form.nextActionAt} onChange={(e) => set("nextActionAt", e.target.value)}
                  className={input()} />
              </Field>
            </div>
          </section>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border sticky bottom-0 bg-card pb-1">
            <button type="button" onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 text-sm bg-primary text-primary-foreground px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium transition-colors">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? "Enregistrement…" : "Créer le prospect"}
            </button>
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

  useEffect(() => {
    fetch("/api/prospects")
      .then((r) => r.json())
      .then(setProspects)
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(p: Prospect) {
    setProspects((prev) => [p, ...prev]);
    setShowModal(false);
  }

  const byStatus = (status: ProspectStatus) => prospects.filter((p) => p.status === status);

  return (
    <>
      {showModal && (
        <NewProspectModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">CRM & Prospection</h1>
            <p className="text-xs text-muted-foreground">
              {prospects.length} prospect{prospects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus size={15} />
            Nouveau prospect
          </button>
        </div>

        {/* Kanban */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <div className="grid p-4 gap-2 h-full" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(0, 1fr))` }}>
              {COLUMNS.map(({ status, label, color }) => {
                const cards = byStatus(status);
                return (
                  <div key={status} className="flex flex-col min-w-0">
                    <div className={`flex items-center justify-between mb-2 pb-2 border-b-2 ${color}`}>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {cards.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                      {cards.map((p) => <ProspectCard key={p.id} prospect={p} />)}
                      {cards.length === 0 && (
                        <p className="text-[11px] text-muted-foreground/50 text-center pt-4">Vide</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
