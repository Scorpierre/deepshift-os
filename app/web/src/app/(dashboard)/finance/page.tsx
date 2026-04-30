"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, Check, Euro,
  FileText, Loader2, Plus, Receipt, Send, Trash2, TrendingUp, X,
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

// ─── Dashboard CA ─────────────────────────────────────────────────────────────

function DashboardTab({ stats }: { stats: Stats | null }) {
  if (!stats) return <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;

  const cards = [
    { label: "CA ce mois", value: `${fmt(stats.caMonth)} €`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "CA cette année", value: `${fmt(stats.caYear)} €`, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "CA total", value: `${fmt(stats.caTotal)} €`, icon: Euro, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
    { label: "Devis en attente", value: String(stats.pendingQuotes), icon: FileText, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "À encaisser", value: `${fmt(stats.pendingInvoicesAmount)} €`, icon: Receipt, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", sub: `${stats.pendingInvoicesCount} facture${stats.pendingInvoicesCount !== 1 ? "s" : ""}` },
    { label: "En retard", value: String(stats.overdueInvoices), icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  ];

  return (
    <div className="p-6">
      <div className="grid grid-cols-3 gap-4 max-w-3xl">
        {cards.map((card) => (
          <div key={card.label} className={`border rounded-2xl p-4 space-y-2 ${card.bg}`}>
            <div className="flex items-center gap-2">
              <card.icon size={14} className={card.color} />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            {"sub" in card && card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Onglet Devis ─────────────────────────────────────────────────────────────

function QuotesTab({ quotes, onRefresh }: { quotes: Quote[]; onRefresh: () => void }) {
  const [sending, setSending] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function sendQuote(id: string) {
    setSending(id);
    await fetch(`/api/quotes/${id}/send`, { method: "POST" });
    onRefresh();
    setSending(null);
  }

  async function acceptQuote(id: string) {
    setAccepting(id);
    await fetch(`/api/quotes/${id}/accept`, { method: "POST" });
    onRefresh();
    setAccepting(null);
  }

  async function deleteQuote(id: string) {
    setDeleting(id);
    await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    onRefresh();
    setDeleting(null);
  }

  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 gap-2">
        <FileText size={32} strokeWidth={1.5} />
        <p className="text-sm">Aucun devis pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {quotes.map((q) => (
        <div key={q.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">{q.number}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${QUOTE_STATUS_COLORS[q.status]}`}>
                {QUOTE_STATUS_LABELS[q.status]}
              </span>
            </div>
            <p className="text-sm font-medium truncate">{q.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {q.prospect.name}{q.prospect.company ? ` — ${q.prospect.company}` : ""}
              {q.validUntil ? ` · valable jusqu'au ${fmtDate(q.validUntil)}` : ""}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-sm font-semibold">{fmt(q.totalHT)} €</p>
            <p className="text-[10px] text-muted-foreground">HT</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {q.status === "DRAFT" && (
              <button
                onClick={() => sendQuote(q.id)}
                disabled={sending === q.id}
                className="flex items-center gap-1 text-xs bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                {sending === q.id ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                Envoyer
              </button>
            )}
            {q.status === "SENT" && !q.invoice && (
              <button
                onClick={() => acceptQuote(q.id)}
                disabled={accepting === q.id}
                className="flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                {accepting === q.id ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}
                Facturer
              </button>
            )}
            {["DRAFT", "REJECTED", "EXPIRED"].includes(q.status) && (
              <button
                onClick={() => deleteQuote(q.id)}
                disabled={deleting === q.id}
                className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                {deleting === q.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Onglet Factures ──────────────────────────────────────────────────────────

function InvoicesTab({ invoices, onRefresh }: { invoices: Invoice[]; onRefresh: () => void }) {
  const [marking, setMarking] = useState<string | null>(null);

  async function markPaid(id: string) {
    setMarking(id);
    await fetch(`/api/invoices/${id}/paid`, { method: "POST" });
    onRefresh();
    setMarking(null);
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 gap-2">
        <Receipt size={32} strokeWidth={1.5} />
        <p className="text-sm">Aucune facture pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {invoices.map((inv) => (
        <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">{inv.number}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${INVOICE_STATUS_COLORS[inv.status]}`}>
                {INVOICE_STATUS_LABELS[inv.status]}
              </span>
              {inv.quote && (
                <span className="text-[10px] text-muted-foreground/50">← {inv.quote.number}</span>
              )}
            </div>
            <p className="text-sm font-medium truncate">{inv.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {inv.prospect.name}{inv.prospect.company ? ` — ${inv.prospect.company}` : ""}
              {inv.status === "PAID"
                ? ` · Payée le ${fmtDate(inv.paidAt)}`
                : ` · Échéance ${fmtDate(inv.dueAt)}`}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-sm font-semibold">{fmt(inv.totalHT)} €</p>
            <p className="text-[10px] text-muted-foreground">HT</p>
          </div>

          {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
            <button
              onClick={() => markPaid(inv.id)}
              disabled={marking === inv.id}
              className="flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
            >
              {marking === inv.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              Payée
            </button>
          )}
        </div>
      ))}
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
    { id: "dashboard", label: "Dashboard", icon: TrendingUp },
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
        <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  tab === t.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <t.icon size={13} />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="text-[10px] bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowQuoteModal(true)}
            className="flex items-center gap-1.5 text-sm bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} />
            Nouveau devis
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {tab === "dashboard" && <DashboardTab stats={stats} />}
          {tab === "quotes" && <QuotesTab quotes={quotes} onRefresh={load} />}
          {tab === "invoices" && <InvoicesTab invoices={invoices} onRefresh={load} />}
        </div>
      </div>
    </>
  );
}
