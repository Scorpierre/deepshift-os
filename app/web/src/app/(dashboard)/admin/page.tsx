"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  BarChart3,
  Check,
  CreditCard,
  Loader2,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpenseCategory = "INFRA" | "TOOLS" | "MARKETING" | "FORMATION" | "EQUIPMENT" | "OTHER";
type ExpenseType = "ONE_TIME" | "SUBSCRIPTION";
type BillingCycle = "MONTHLY" | "ANNUAL";

type Expense = {
  id: string;
  createdAt: string;
  label: string;
  vendor: string | null;
  amount: number;
  date: string;
  category: ExpenseCategory;
  type: ExpenseType;
  billingCycle: BillingCycle | null;
  renewsAt: string | null;
  isActive: boolean;
  notes: string | null;
};

type Stats = {
  monthlyRecurring: number;
  annualBurden: number;
  expensesThisMonth: number;
  activeSubscriptions: number;
  byCategory: { category: string; amount: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateShort(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  INFRA: "Infra",
  TOOLS: "Outils",
  MARKETING: "Marketing",
  FORMATION: "Formation",
  EQUIPMENT: "Matériel",
  OTHER: "Autre",
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  INFRA: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  TOOLS: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  MARKETING: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  FORMATION: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  EQUIPMENT: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  OTHER: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
};

const CATEGORY_BAR: Record<ExpenseCategory, string> = {
  INFRA: "bg-blue-400",
  TOOLS: "bg-violet-400",
  MARKETING: "bg-emerald-400",
  FORMATION: "bg-amber-400",
  EQUIPMENT: "bg-orange-400",
  OTHER: "bg-zinc-400",
};

function daysUntilRenewal(renewsAt: string | null): number | null {
  if (!renewsAt) return null;
  return Math.ceil((new Date(renewsAt).getTime() - Date.now()) / 86400000);
}

// ─── Modal Dépense / Abonnement ───────────────────────────────────────────────

type ModalForm = {
  label: string;
  vendor: string;
  amount: string;
  date: string;
  category: ExpenseCategory;
  type: ExpenseType;
  billingCycle: BillingCycle;
  renewsAt: string;
  notes: string;
};

const EMPTY_FORM: ModalForm = {
  label: "",
  vendor: "",
  amount: "",
  date: new Date().toISOString().split("T")[0],
  category: "TOOLS",
  type: "SUBSCRIPTION",
  billingCycle: "MONTHLY",
  renewsAt: "",
  notes: "",
};

function ExpenseModal({
  expense,
  onClose,
  onSaved,
}: {
  expense?: Expense;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ModalForm>(() =>
    expense
      ? {
          label: expense.label,
          vendor: expense.vendor ?? "",
          amount: String(expense.amount),
          date: expense.date.split("T")[0],
          category: expense.category,
          type: expense.type,
          billingCycle: expense.billingCycle ?? "MONTHLY",
          renewsAt: expense.renewsAt ? expense.renewsAt.split("T")[0] : "",
          notes: expense.notes ?? "",
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ModalForm>(k: K, v: ModalForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    if (!form.label || !form.amount) return;
    setSaving(true);
    const body = {
      label: form.label,
      vendor: form.vendor || null,
      amount: Number(form.amount),
      date: form.type === "ONE_TIME" ? form.date : new Date().toISOString(),
      category: form.category,
      type: form.type,
      billingCycle: form.type === "SUBSCRIPTION" ? form.billingCycle : null,
      renewsAt: form.type === "SUBSCRIPTION" && form.renewsAt ? form.renewsAt : null,
      notes: form.notes || null,
    };
    if (expense) {
      await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    onSaved();
    onClose();
  }

  const isEdit = !!expense;
  const isSubscription = form.type === "SUBSCRIPTION";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            {isSubscription ? (
              <RotateCcw size={14} className="text-violet-400" />
            ) : (
              <ArrowDownCircle size={14} className="text-amber-400" />
            )}
            {isEdit ? "Modifier" : "Nouveau"}{" "}
            {isSubscription ? "abonnement" : "dépense"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {!isEdit && (
            <div className="flex rounded-xl overflow-hidden border border-border">
              <button
                onClick={() => set("type", "SUBSCRIPTION")}
                className={`flex-1 text-sm py-2 flex items-center justify-center gap-1.5 transition-colors ${
                  isSubscription
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <RotateCcw size={12} /> Abonnement
              </button>
              <button
                onClick={() => set("type", "ONE_TIME")}
                className={`flex-1 text-sm py-2 flex items-center justify-center gap-1.5 transition-colors ${
                  !isSubscription
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <ArrowDownCircle size={12} /> Dépense ponctuelle
              </button>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Libellé *
            </label>
            <input
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder={isSubscription ? "ex: Azure VM" : "ex: Livre TypeScript avancé"}
              className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Fournisseur
              </label>
              <input
                value={form.vendor}
                onChange={(e) => set("vendor", e.target.value)}
                placeholder="ex: Microsoft"
                className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Catégorie
              </label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value as ExpenseCategory)}
                className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
              >
                {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Montant (€) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
                className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
              />
            </div>

            {isSubscription ? (
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Cycle
                </label>
                <select
                  value={form.billingCycle}
                  onChange={(e) => set("billingCycle", e.target.value as BillingCycle)}
                  className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
                >
                  <option value="MONTHLY">Mensuel</option>
                  <option value="ANNUAL">Annuel</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            )}
          </div>

          {isSubscription && (
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Prochain renouvellement
              </label>
              <input
                type="date"
                value={form.renewsAt}
                onChange={(e) => set("renewsAt", e.target.value)}
                className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/40 transition-colors"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Notes (optionnel)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="w-full text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 resize-none outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/35"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-xl hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving || !form.label || !form.amount}
            className={`text-sm disabled:opacity-40 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
              isSubscription
                ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
            }`}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {isEdit ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Vue d'ensemble ───────────────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    {
      label: "Charges mensuelles",
      value: `${fmt(stats.monthlyRecurring)} €`,
      sub: "abonnements actifs normalisés",
      icon: RotateCcw,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
    {
      label: "Dépenses ce mois",
      value: `${fmt(stats.expensesThisMonth)} €`,
      sub: "ponctuelles",
      icon: ArrowDownCircle,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      label: "Projection annuelle",
      value: `${fmt(stats.annualBurden)} €`,
      sub: "tous abonnements actifs",
      icon: BarChart3,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Abonnements actifs",
      value: String(stats.activeSubscriptions),
      sub: "en cours",
      icon: CreditCard,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  const maxAmount = Math.max(...stats.byCategory.map((c) => c.amount), 1);

  return (
    <div className="p-6 space-y-8">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        {cards.map((card) => (
          <div key={card.label} className={`border rounded-2xl p-4 space-y-1.5 ${card.bg}`}>
            <div className="flex items-center gap-2">
              <card.icon size={13} className={card.color} />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {card.label}
              </span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      {stats.byCategory.length > 0 && (
        <div className="max-w-2xl space-y-3">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wide">
            Répartition mensuelle par catégorie
          </h3>
          <div className="space-y-3">
            {stats.byCategory
              .sort((a, b) => b.amount - a.amount)
              .map(({ category, amount }) => (
                <div key={category} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          CATEGORY_BAR[category as ExpenseCategory] ?? "bg-zinc-400"
                        }`}
                      />
                      <span className="text-sm text-foreground/80">
                        {CATEGORY_LABELS[category as ExpenseCategory] ?? category}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {fmt(amount)} €/mo
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        CATEGORY_BAR[category as ExpenseCategory] ?? "bg-zinc-400"
                      }`}
                      style={{ width: `${(amount / maxAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Abonnements ──────────────────────────────────────────────────────────────

function SubscriptionsTab({
  expenses,
  onRefresh,
  onEdit,
}: {
  expenses: Expense[];
  onRefresh: () => void;
  onEdit: (e: Expense) => void;
}) {
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const subs = expenses.filter((e) => e.type === "SUBSCRIPTION");
  const active = subs.filter((s) => s.isActive);
  const inactive = subs.filter((s) => !s.isActive);

  async function toggle(sub: Expense) {
    setToggling(sub.id);
    await fetch(`/api/expenses/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !sub.isActive }),
    });
    onRefresh();
    setToggling(null);
  }

  async function del(id: string) {
    setDeleting(id);
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    onRefresh();
    setDeleting(null);
  }

  function SubRow({ sub }: { sub: Expense }) {
    const days = daysUntilRenewal(sub.renewsAt);
    const isUrgent = days !== null && days <= 7;
    const isWarning = days !== null && days > 7 && days <= 30;
    const monthly = sub.billingCycle === "ANNUAL" ? sub.amount / 12 : sub.amount;

    return (
      <div
        className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors ${
          !sub.isActive ? "opacity-50" : ""
        }`}
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{sub.label}</span>
            {sub.vendor && (
              <span className="text-xs text-muted-foreground/60">{sub.vendor}</span>
            )}
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                CATEGORY_COLORS[sub.category]
              }`}
            >
              {CATEGORY_LABELS[sub.category]}
            </span>
            {(isUrgent || isWarning) && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                  isUrgent
                    ? "bg-red-500/15 text-red-400 border-red-500/25"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/25"
                }`}
              >
                <AlertTriangle size={9} />
                {days === 0 ? "Aujourd'hui" : `${days}j`}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {sub.billingCycle === "MONTHLY" ? "Mensuel" : "Annuel"}
            {sub.renewsAt ? ` · renouvellement : ${fmtDateShort(sub.renewsAt)}` : ""}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{fmt(sub.amount)} €</p>
          {sub.billingCycle === "ANNUAL" && (
            <p className="text-[10px] text-muted-foreground">≈ {fmt(monthly)} €/mo</p>
          )}
          {sub.billingCycle === "MONTHLY" && (
            <p className="text-[10px] text-muted-foreground">/mo</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(sub)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Settings size={12} />
          </button>
          <button
            onClick={() => toggle(sub)}
            disabled={toggling === sub.id}
            className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              sub.isActive
                ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {toggling === sub.id ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sub.isActive ? "bg-emerald-400" : "bg-zinc-500"
                }`}
              />
            )}
            {sub.isActive ? "Actif" : "Inactif"}
          </button>
          <button
            onClick={() => del(sub.id)}
            disabled={deleting === sub.id}
            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            {deleting === sub.id ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
          </button>
        </div>
      </div>
    );
  }

  if (subs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 gap-2">
        <RotateCcw size={32} strokeWidth={1.5} />
        <p className="text-sm">Aucun abonnement enregistré.</p>
      </div>
    );
  }

  return (
    <div>
      {active.length > 0 && (
        <>
          <div className="px-5 py-2 bg-muted/20 border-b border-border">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Actifs ({active.length})
            </span>
          </div>
          <div className="divide-y divide-border">
            {active.map((sub) => (
              <SubRow key={sub.id} sub={sub} />
            ))}
          </div>
        </>
      )}
      {inactive.length > 0 && (
        <>
          <div className="px-5 py-2 bg-muted/20 border-b border-border mt-4">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Inactifs ({inactive.length})
            </span>
          </div>
          <div className="divide-y divide-border">
            {inactive.map((sub) => (
              <SubRow key={sub.id} sub={sub} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dépenses ponctuelles ─────────────────────────────────────────────────────

type Period = "month" | "year" | "all";
const PERIOD_LABELS: Record<Period, string> = {
  month: "Ce mois",
  year: "Cette année",
  all: "Tout",
};

function ExpensesTab({
  expenses,
  onRefresh,
  onEdit,
}: {
  expenses: Expense[];
  onRefresh: () => void;
  onEdit: (e: Expense) => void;
}) {
  const [period, setPeriod] = useState<Period>("month");
  const [deleting, setDeleting] = useState<string | null>(null);

  const now = new Date();
  const oneTime = expenses.filter((e) => e.type === "ONE_TIME");
  const filtered = oneTime.filter((e) => {
    const d = new Date(e.date);
    if (period === "month")
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (period === "year") return d.getFullYear() === now.getFullYear();
    return true;
  });

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  async function del(id: string) {
    setDeleting(id);
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    onRefresh();
    setDeleting(null);
  }

  if (oneTime.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 gap-2">
        <ArrowDownCircle size={32} strokeWidth={1.5} />
        <p className="text-sm">Aucune dépense ponctuelle enregistrée.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-muted/10">
        <div className="flex items-center gap-1">
          {(["month", "year", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                period === p
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Total :{" "}
            <span className="text-foreground font-medium">{fmt(total)} €</span>
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
          <p className="text-sm">Aucune dépense sur cette période.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors"
            >
              <div className="text-xs text-muted-foreground/60 font-mono shrink-0 w-14">
                {fmtDateShort(e.date)}
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{e.label}</span>
                  {e.vendor && (
                    <span className="text-xs text-muted-foreground/60">{e.vendor}</span>
                  )}
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                      CATEGORY_COLORS[e.category]
                    }`}
                  >
                    {CATEGORY_LABELS[e.category]}
                  </span>
                </div>
                {e.notes && (
                  <p className="text-xs text-muted-foreground/60 truncate">{e.notes}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{fmt(e.amount)} €</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onEdit(e)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <Settings size={12} />
                </button>
                <button
                  onClick={() => del(e.id)}
                  disabled={deleting === e.id}
                  className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  {deleting === e.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Weekly Review ────────────────────────────────────────────────────────────

function WeeklyReviewTab() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/weekly-summary", { method: "POST" });
      const data = await res.json();
      setSummary(data.summary ?? null);
      setGeneratedAt(new Date());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">Weekly Review IA</h3>
          <p className="text-xs text-muted-foreground">
            Résumé CRM + Finance + Projets généré par Claude.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 text-sm bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/20 disabled:opacity-50 px-4 py-2 rounded-xl transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? "Génération en cours…" : "Générer le résumé"}
        </button>
      </div>

      {summary ? (
        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
            <Sparkles size={12} className="text-violet-400" />
            <span className="text-xs text-muted-foreground">
              Généré le{" "}
              {generatedAt?.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              à{" "}
              {generatedAt?.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="p-5">
            <pre className="text-sm text-foreground/85 whitespace-pre-wrap font-sans leading-relaxed">
              {summary}
            </pre>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-2xl flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground/40">
          <Sparkles size={28} strokeWidth={1.5} />
          <p className="text-sm">Cliquez sur &quot;Générer&quot; pour analyser la semaine.</p>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type Tab = "overview" | "subscriptions" | "expenses" | "weekly";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ expense?: Expense } | null>(null);

  const load = useCallback(async () => {
    const [exp, st] = await Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/expenses/stats").then((r) => r.json()),
    ]);
    setExpenses(Array.isArray(exp) ? exp : []);
    setStats(st);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const activeSubsCount = expenses.filter(
    (e) => e.type === "SUBSCRIPTION" && e.isActive
  ).length;

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "overview", label: "Vue d'ensemble", icon: BarChart3 },
    {
      id: "subscriptions",
      label: "Abonnements",
      icon: RotateCcw,
      count: activeSubsCount,
    },
    { id: "expenses", label: "Dépenses", icon: ArrowDownCircle },
    { id: "weekly", label: "Weekly Review", icon: Sparkles },
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
      {modal !== null && (
        <ExpenseModal
          expense={modal.expense}
          onClose={() => setModal(null)}
          onSaved={load}
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
                  <span className="text-[10px] bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab !== "weekly" && (
            <button
              onClick={() => setModal({})}
              className="flex items-center gap-1.5 text-sm bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} />
              Ajouter
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {tab === "overview" && <OverviewTab stats={stats} />}
          {tab === "subscriptions" && (
            <SubscriptionsTab
              expenses={expenses}
              onRefresh={load}
              onEdit={(e) => setModal({ expense: e })}
            />
          )}
          {tab === "expenses" && (
            <ExpensesTab
              expenses={expenses}
              onRefresh={load}
              onEdit={(e) => setModal({ expense: e })}
            />
          )}
          {tab === "weekly" && <WeeklyReviewTab />}
        </div>
      </div>
    </>
  );
}
