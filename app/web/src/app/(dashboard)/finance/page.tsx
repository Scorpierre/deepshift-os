"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Check,
  FileText, Loader2, Plus, Receipt, Search, Send, Trash2, TrendingUp, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuoteLine = { description: string; qty: number; unitPrice: number; total: number };

type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
type InvoiceStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

type ProspectRef = { id: string; name: string; company: string | null; email: string };

type Quote = {
  id: string;
  createdAt: string;
  number: string;
  title: string;
  lines: QuoteLine[];
  totalHT: number;
  validUntil: string | null;
  sentAt: string | null;
  notes: string | null;
  status: QuoteStatus;
  prospect: ProspectRef;
  invoice?: { id: string } | null;
};

type Invoice = {
  id: string;
  createdAt: string;
  number: string;
  title: string;
  lines: QuoteLine[];
  totalHT: number;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  notes: string | null;
  status: InvoiceStatus;
  prospect: ProspectRef;
  quote: { number: string } | null;
};

type Stats = {
  caMonth: number;
  caYear: number;
  caTotal: number;
  pendingQuotes: number;
  pendingInvoicesAmount: number;
  pendingInvoicesCount: number;
  overdueInvoices: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Brouillon", SENT: "Envoyé", ACCEPTED: "Accepté", REJECTED: "Refusé", EXPIRED: "Expiré",
};
const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  DRAFT: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  SENT: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  ACCEPTED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
  EXPIRED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: "En attente", PAID: "Payée", OVERDUE: "En retard", CANCELLED: "Annulée",
};
const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  PENDING: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  PAID: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  OVERDUE: "bg-red-500/20 text-red-400 border-red-500/30",
  CANCELLED: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

// ─── Modal Nouveau Devis ───────────────────────────────────────────────────────

function QuoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [prospects, setProspects] = useState<ProspectRef[]>([]);
  const [prospectId, setProspectId] = useState("");
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([{ description: "", qty: 1, unitPrice: 0, total: 0 }]);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/prospects").then((r) => r.json()).then(setProspects);
  }, []);

  function updateLine(i: number, field: keyof QuoteLine, value: string | number) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === "qty" || field === "unitPrice") {
        next[i].total = Number(next[i].qty) * Number(next[i].unitPrice);
      }
      return next;
    });
  }

  const totalHT = lines.reduce((sum, l) => sum + l.total, 0);

  async function save() {
    if (!prospectId || !title) return;
    setSaving(true);
    await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId, title, lines, totalHT, validUntil: validUntil || null, notes: notes || null }),
    });
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <FileText size={15} className="text-blue-400" />
            Nouveau devis
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Client</label>
            <select
              value={prospectId}
              onChange={(e) => setProspectId(e.target.value)}
              className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
            >
              <option value="">Sélectionner un client…</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.company ? ` — ${p.company}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Objet du devis</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Création site vitrine + SEO"
              className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Prestations</label>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_90px_80px_28px] gap-2 items-center">
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    placeholder="Description"
                    className="text-sm bg-muted/30 border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
                  />
                  <input
                    type="number" min="1" value={line.qty}
                    onChange={(e) => updateLine(i, "qty", Number(e.target.value))}
                    className="text-sm bg-muted/30 border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary/40 transition-colors text-center"
                  />
                  <input
                    type="number" min="0" value={line.unitPrice}
                    onChange={(e) => updateLine(i, "unitPrice", Number(e.target.value))}
                    placeholder="PU HT"
                    className="text-sm bg-muted/30 border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary/40 transition-colors"
                  />
                  <span className="text-sm text-right text-foreground/70 font-medium">{fmt(line.total)} €</span>
                  <button
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                    className="text-muted-foreground hover:text-red-400 disabled:opacity-20 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setLines((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, total: 0 }])}
                className="text-xs text-muted-foreground/50 hover:text-foreground border border-dashed border-border/60 rounded-lg px-3 py-1.5 hover:border-border transition-colors flex items-center gap-1"
              >
                <Plus size={10} /> Ajouter une ligne
              </button>
              <p className="text-sm font-semibold">Total HT : <span className="text-foreground">{fmt(totalHT)} €</span></p>
            </div>
            <p className="text-[10px] text-muted-foreground/50">Auto-entrepreneur non assujetti à la TVA — article 293 B du CGI</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Valable jusqu'au</label>
              <input
                type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Notes (optionnel)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions particulières, modalités de paiement…"
              rows={2}
              className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 resize-none outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-xl hover:bg-muted transition-colors">
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving || !prospectId || !title}
            className="text-sm bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-40 px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            Créer le devis
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

const eur0 = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

const QUOTE_DOT: Record<QuoteStatus, string> = { DRAFT: "bg-zinc-400", SENT: "bg-blue-400", ACCEPTED: "bg-emerald-400", REJECTED: "bg-red-400", EXPIRED: "bg-amber-400" };
const INVOICE_DOT: Record<InvoiceStatus, string> = { PENDING: "bg-amber-400", PAID: "bg-emerald-400", OVERDUE: "bg-red-400", CANCELLED: "bg-zinc-500" };

function Pill({ cls, dot, children }: { cls: string; dot: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />{children}
    </span>
  );
}

function clientName(p: ProspectRef) {
  return p.company ?? p.name;
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; count: number }[] }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border w-fit">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5 ${value === o.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}<span className="text-[10px] tabular-nums text-muted-foreground/60">{o.count}</span>
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full max-w-xs">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder="Client, numéro, objet…"
        className="w-full text-sm bg-muted/30 border border-border rounded-lg pl-8 pr-3 py-2 outline-none focus:border-primary/40 placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 gap-2 rounded-xl border border-dashed border-border">
      <Icon size={32} strokeWidth={1.5} /><p className="text-sm">{text}</p>
    </div>
  );
}

const TH = "px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground/60 text-left";

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardTab({ stats, quotes, invoices, goTo }: { stats: Stats | null; quotes: Quote[]; invoices: Invoice[]; goTo: (t: Tab) => void }) {
  if (!stats) return <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;

  const overdue = invoices.filter((i) => i.status === "OVERDUE");
  const drafts = quotes.filter((q) => q.status === "DRAFT");
  const awaiting = quotes.filter((q) => q.status === "SENT" && !q.invoice);
  const monthShare = stats.caYear > 0 ? Math.min(100, Math.round((stats.caMonth / stats.caYear) * 100)) : 0;

  const todo = [
    ...overdue.map((i) => ({ key: i.id, tone: "bg-red-500/15 text-red-300", icon: AlertTriangle, title: `${i.number} en retard`, sub: `${clientName(i.prospect)} · échue le ${fmtDate(i.dueAt)}`, amount: i.totalHT, tab: "invoices" as Tab })),
    ...awaiting.map((q) => ({ key: q.id, tone: "bg-blue-500/15 text-blue-300", icon: Send, title: `${q.number} sans réponse`, sub: `${clientName(q.prospect)} · envoyé le ${fmtDate(q.sentAt)}`, amount: q.totalHT, tab: "quotes" as Tab })),
    ...drafts.map((q) => ({ key: q.id, tone: "bg-zinc-500/15 text-zinc-300", icon: FileText, title: `${q.number} à finaliser`, sub: `${clientName(q.prospect)} · brouillon`, amount: q.totalHT, tab: "quotes" as Tab })),
  ];

  return (
    <div className="px-6 py-5 space-y-5 max-w-[1200px] mx-auto">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-card to-card p-6">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp size={13} className="text-emerald-400" />Chiffre d'affaires du mois</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums mt-2">{eur0(stats.caMonth)}</p>
          <div className="mt-5 space-y-1.5">
            <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${monthShare}%` }} /></div>
            <p className="text-[11px] text-muted-foreground">{monthShare}% du CA annuel ({eur0(stats.caYear)}) · CA total {eur0(stats.caTotal)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Receipt size={13} className="text-amber-400" />À encaisser</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{eur0(stats.pendingInvoicesAmount)}</p>
            <p className="text-[11px] text-muted-foreground">{stats.pendingInvoicesCount} facture{stats.pendingInvoicesCount !== 1 ? "s" : ""}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${stats.overdueInvoices ? "border-red-500/25 bg-red-500/5" : "border-border bg-card/60"}`}>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertTriangle size={13} className={stats.overdueInvoices ? "text-red-400" : "text-emerald-400"} />En retard</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{stats.overdueInvoices}</p>
            <p className="text-[11px] text-muted-foreground">{stats.pendingQuotes} devis en attente</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-medium">À traiter</h2>
          <span className="text-[11px] text-muted-foreground">{todo.length} action{todo.length !== 1 ? "s" : ""}</span>
        </div>
        {todo.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground/60">Tout est à jour 🎉</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {todo.map((t) => (
              <li key={t.key}>
                <button onClick={() => goTo(t.tab)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/30 transition-colors">
                  <span className={`size-8 rounded-lg grid place-items-center shrink-0 ${t.tone}`}><t.icon size={14} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{t.title}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">{t.sub}</span>
                  </span>
                  <span className="text-sm tabular-nums">{eur0(t.amount)}</span>
                  <ArrowRight size={13} className="text-muted-foreground/40" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Devis ────────────────────────────────────────────────────────────────────

type QuoteFilter = "all" | "DRAFT" | "SENT" | "ACCEPTED" | "closed";

function QuotesTab({ quotes, onRefresh }: { quotes: Quote[]; onRefresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuoteFilter>("all");
  const [query, setQuery] = useState("");

  async function act(id: string, path: string, method = "POST") {
    setBusy(id + path);
    await fetch(`/api/quotes/${id}${path}`, { method });
    onRefresh();
    setBusy(null);
  }

  const match = (f: QuoteFilter, q: Quote) => f === "all" || (f === "closed" ? ["REJECTED", "EXPIRED"].includes(q.status) : q.status === f);
  const options = ([["all", "Tous"], ["DRAFT", "Brouillons"], ["SENT", "Envoyés"], ["ACCEPTED", "Acceptés"], ["closed", "Clos"]] as const)
    .map(([key, label]) => ({ key, label, count: quotes.filter((q) => match(key, q)).length }));

  const rows = useMemo(() => {
    const s = query.trim().toLowerCase();
    return quotes.filter((q) => match(filter, q) && (!s || `${q.number} ${q.title} ${q.prospect.name} ${q.prospect.company ?? ""}`.toLowerCase().includes(s)));
  }, [quotes, filter, query]);

  const open = quotes.filter((q) => q.status === "SENT").reduce((s, q) => s + q.totalHT, 0);

  return (
    <div className="px-6 py-5 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={filter} onChange={setFilter} options={options} />
        <SearchBox value={query} onChange={setQuery} />
        <p className="ml-auto text-xs text-muted-foreground">En attente de réponse : <span className="text-foreground font-medium tabular-nums">{eur0(open)}</span></p>
      </div>

      {rows.length === 0 ? <EmptyState icon={FileText} text="Aucun devis." /> : (
        <div className="rounded-xl border border-border bg-card/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className={TH}>Devis</th><th className={TH}>Client</th><th className={TH}>Statut</th>
              <th className={`${TH} max-md:hidden`}>Validité</th><th className={`${TH} text-right`}>Montant HT</th><th className={TH} />
            </tr></thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((q) => {
                const left = q.validUntil ? daysUntil(q.validUntil) : null;
                return (
                  <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-64">{q.title}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{q.number}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{clientName(q.prospect)}</td>
                    <td className="px-4 py-3"><Pill cls={QUOTE_STATUS_COLORS[q.status]} dot={QUOTE_DOT[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Pill></td>
                    <td className="px-4 py-3 text-xs max-md:hidden">
                      {q.validUntil ? <span className={left !== null && left < 0 ? "text-red-400" : left !== null && left <= 5 ? "text-amber-400" : "text-muted-foreground"}>{fmtDate(q.validUntil)}</span> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">{fmt(q.totalHT)} €</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {q.status === "DRAFT" && (
                          <button onClick={() => act(q.id, "/send")} disabled={busy === q.id + "/send"} className="flex items-center gap-1 text-xs bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors">
                            {busy === q.id + "/send" ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}Envoyer
                          </button>
                        )}
                        {q.status === "SENT" && !q.invoice && (
                          <button onClick={() => act(q.id, "/accept")} disabled={busy === q.id + "/accept"} className="flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors">
                            {busy === q.id + "/accept" ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}Facturer
                          </button>
                        )}
                        {["DRAFT", "REJECTED", "EXPIRED"].includes(q.status) && (
                          <button onClick={() => act(q.id, "", "DELETE")} disabled={busy === q.id} aria-label="Supprimer" className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                            {busy === q.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Factures ─────────────────────────────────────────────────────────────────

type InvoiceFilter = "all" | InvoiceStatus;

function InvoicesTab({ invoices, onRefresh }: { invoices: Invoice[]; onRefresh: () => void }) {
  const [marking, setMarking] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [query, setQuery] = useState("");

  async function markPaid(id: string) {
    setMarking(id);
    await fetch(`/api/invoices/${id}/paid`, { method: "POST" });
    onRefresh();
    setMarking(null);
  }

  const options = ([["all", "Toutes"], ["PENDING", "En attente"], ["OVERDUE", "En retard"], ["PAID", "Payées"]] as const)
    .map(([key, label]) => ({ key, label, count: invoices.filter((i) => key === "all" || i.status === key).length }));

  const rows = useMemo(() => {
    const s = query.trim().toLowerCase();
    return invoices.filter((i) => (filter === "all" || i.status === filter) && (!s || `${i.number} ${i.title} ${i.prospect.name} ${i.prospect.company ?? ""}`.toLowerCase().includes(s)));
  }, [invoices, filter, query]);

  const outstanding = invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE").reduce((s, i) => s + i.totalHT, 0);

  return (
    <div className="px-6 py-5 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={filter} onChange={setFilter} options={options} />
        <SearchBox value={query} onChange={setQuery} />
        <p className="ml-auto text-xs text-muted-foreground">Reste à encaisser : <span className="text-foreground font-medium tabular-nums">{eur0(outstanding)}</span></p>
      </div>

      {rows.length === 0 ? <EmptyState icon={Receipt} text="Aucune facture." /> : (
        <div className="rounded-xl border border-border bg-card/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className={TH}>Facture</th><th className={TH}>Client</th><th className={TH}>Statut</th>
              <th className={`${TH} max-md:hidden`}>Échéance</th><th className={`${TH} text-right`}>Montant HT</th><th className={TH} />
            </tr></thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((inv) => {
                const left = daysUntil(inv.dueAt);
                const open = inv.status === "PENDING" || inv.status === "OVERDUE";
                return (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-64">{inv.title}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{inv.number}{inv.quote ? ` · ${inv.quote.number}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{clientName(inv.prospect)}</td>
                    <td className="px-4 py-3"><Pill cls={INVOICE_STATUS_COLORS[inv.status]} dot={INVOICE_DOT[inv.status]}>{INVOICE_STATUS_LABELS[inv.status]}</Pill></td>
                    <td className="px-4 py-3 text-xs max-md:hidden">
                      {inv.status === "PAID" ? <span className="text-muted-foreground">Payée le {fmtDate(inv.paidAt)}</span>
                        : <span className={left < 0 ? "text-red-400" : left <= 7 ? "text-amber-400" : "text-muted-foreground"}>{fmtDate(inv.dueAt)}{open && ` · ${left < 0 ? `${-left} j de retard` : `J-${left}`}`}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">{fmt(inv.totalHT)} €</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {open && (
                          <button onClick={() => markPaid(inv.id)} disabled={marking === inv.id} className="flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors">
                            {marking === inv.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}Payée
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type Tab = "dashboard" | "quotes" | "invoices";

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const load = useCallback(async () => {
    const [q, inv, st] = await Promise.all([
      fetch("/api/quotes").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/finance/stats").then((r) => r.json()),
    ]);
    setQuotes(q);
    setInvoices(inv);
    setStats(st);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "dashboard", label: "Vue d'ensemble", icon: TrendingUp },
    { id: "quotes", label: "Devis", icon: FileText, count: quotes.length },
    { id: "invoices", label: "Factures", icon: Receipt, count: invoices.length },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {showQuoteModal && (
        <QuoteModal
          onClose={() => setShowQuoteModal(false)}
          onCreated={() => { load(); setTab("quotes"); }}
        />
      )}

      <div className="flex flex-col h-full overflow-hidden">
        <header className="px-6 pt-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-semibold text-base tracking-tight">Finance</h1>
              <p className="text-xs text-muted-foreground">Devis, facturation et encaissements</p>
            </div>
            <button
              onClick={() => setShowQuoteModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white px-3.5 py-2 rounded-lg shadow-lg shadow-emerald-500/20 transition-colors"
            >
              <Plus size={14} /> Nouveau devis
            </button>
          </div>
          <nav className="flex gap-6 mt-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 text-sm pb-3 -mb-px border-b-2 transition-colors ${tab === t.id ? "border-emerald-400 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <t.icon size={13} />{t.label}
                {t.count !== undefined && t.count > 0 && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full tabular-nums">{t.count}</span>}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto">
          {tab === "dashboard" && <DashboardTab stats={stats} quotes={quotes} invoices={invoices} goTo={setTab} />}
          {tab === "quotes" && <QuotesTab quotes={quotes} onRefresh={load} />}
          {tab === "invoices" && <InvoicesTab invoices={invoices} onRefresh={load} />}
        </div>
      </div>
    </>
  );
}
