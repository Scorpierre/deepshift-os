"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, CalendarClock, ChevronRight, ExternalLink, FolderKanban, Loader2, Mail, Phone, Plus, Search, Wallet,
} from "lucide-react";

type ProjectStatus = "BRIEF" | "IN_PROGRESS" | "REVIEW" | "DELIVERED" | "COMPLETED" | "MAINTENANCE" | "ON_HOLD";

type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  budget: number | null;
  deadline: string | null;
};

type Client = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  status: string;
  projects: Project[];
};

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
const AVATAR_TONES = [
  "from-violet-500/40 to-fuchsia-500/20", "from-blue-500/40 to-cyan-500/20",
  "from-emerald-500/40 to-teal-500/20", "from-amber-500/40 to-orange-500/20", "from-rose-500/40 to-pink-500/20",
];

const eur = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
const isActive = (p: Project) => !["COMPLETED", "ON_HOLD", "MAINTENANCE"].includes(p.status);
const revenue = (c: Client) => c.projects.reduce((s, p) => s + (p.budget ?? 0), 0);
const label = (c: Client) => c.company ?? c.name;
const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const tone = (s: string) => AVATAR_TONES[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_TONES.length];

function Avatar({ name, size = "size-10" }: { name: string; size?: string }) {
  return (
    <div className={`${size} rounded-xl bg-gradient-to-br ${tone(name)} border border-white/10 grid place-items-center text-xs font-semibold shrink-0`}>
      {initials(name)}
    </div>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetch("/api/clients").then((r) => r.json());
    setClients(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => !q || `${c.name} ${c.company ?? ""} ${c.email}`.toLowerCase().includes(q))
      .sort((a, b) => revenue(b) - revenue(a));
  }, [clients, query]);

  const selected = clients.find((c) => c.id === selectedId) ?? list[0] ?? null;
  const totals = useMemo(() => ({
    revenue: clients.reduce((s, c) => s + revenue(c), 0),
    active: clients.reduce((s, c) => s + c.projects.filter(isActive).length, 0),
  }), [clients]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="font-semibold text-base tracking-tight">Clients</h1>
          <p className="text-xs text-muted-foreground">
            {clients.length} client{clients.length > 1 ? "s" : ""} · {totals.active} projet{totals.active > 1 ? "s" : ""} actif{totals.active > 1 ? "s" : ""} · {eur(totals.revenue)} de CA cumulé
          </p>
        </div>
        <button
          onClick={() => router.push("/crm")}
          className="flex items-center gap-1.5 text-sm font-medium border border-border hover:bg-muted px-3.5 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Nouveau prospect
        </button>
      </header>

      {clients.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50 gap-2">
          <Building2 size={36} strokeWidth={1.5} />
          <p className="text-sm">Aucun client pour l'instant.</p>
          <p className="text-xs">Les prospects passés en WON apparaissent ici.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[340px_1fr]">
          {/* Liste */}
          <aside className="border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-0 max-lg:max-h-72">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full text-sm bg-muted/30 border border-border rounded-lg pl-8 pr-3 py-2 outline-none focus:border-primary/40 placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
            <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {list.map((c) => {
                const active = c.projects.filter(isActive).length;
                const on = selected?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${on ? "bg-muted ring-1 ring-border" : "hover:bg-muted/50"}`}
                    >
                      <Avatar name={label(c)} size="size-9" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{label(c)}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{c.company ? c.name : c.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs tabular-nums">{eur(revenue(c))}</p>
                        {active > 0 && <p className="text-[10px] text-blue-300">{active} actif{active > 1 ? "s" : ""}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
              {list.length === 0 && <li className="text-center text-xs text-muted-foreground/50 py-8">Aucun résultat</li>}
            </ul>
          </aside>

          {/* Détail */}
          {selected && (
            <section className="overflow-y-auto min-h-0">
              <div className="max-w-3xl mx-auto p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <Avatar name={label(selected)} size="size-14" />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold tracking-tight truncate">{label(selected)}</h2>
                    {selected.company && <p className="text-sm text-muted-foreground">{selected.name}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail size={12} />{selected.email}</a>
                      {selected.phone && <span className="inline-flex items-center gap-1.5"><Phone size={12} />{selected.phone}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/crm/${selected.id}`)}
                    className="shrink-0 flex items-center gap-1.5 text-xs border border-border hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                  >
                    <ExternalLink size={12} /> Fiche CRM
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Wallet, label: "CA cumulé", value: eur(revenue(selected)) },
                    { icon: FolderKanban, label: "Projets", value: String(selected.projects.length) },
                    { icon: CalendarClock, label: "Actifs", value: String(selected.projects.filter(isActive).length) },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border bg-card/50 p-3.5">
                      <s.icon size={14} className="text-muted-foreground mb-2" />
                      <p className="text-lg font-semibold tabular-nums leading-tight">{s.value}</p>
                      <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Projets</h3>
                    <button
                      onClick={() => router.push(`/projets?client=${selected.id}`)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Plus size={12} /> Nouveau projet
                    </button>
                  </div>
                  {selected.projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground/50 rounded-xl border border-dashed border-border p-6 text-center">Aucun projet associé.</p>
                  ) : (
                    <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                      {selected.projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => router.push(`/projets/${p.id}`)}
                          className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium truncate">{p.name}</span>
                            {p.deadline && (
                              <span className="text-[11px] text-muted-foreground">
                                Échéance {new Date(p.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            )}
                          </span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                          <span className="text-xs tabular-nums text-muted-foreground w-20 text-right">{p.budget ? eur(p.budget) : "—"}</span>
                          <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
