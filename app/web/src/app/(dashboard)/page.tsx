import Link from "next/link";
import {
  Users,
  KanbanSquare,
  BarChart3,
  Settings2,
  CalendarDays,
  ArrowRight,
  AlertTriangle,
  Bell,
  Euro,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const modules = [
  { slug: "crm", label: "CRM & Prospection", description: "Pipeline, scoring IA, relances", icon: Users, color: "text-blue-400", bg: "bg-blue-400/10" },
  { slug: "projets", label: "Projets", description: "Jalons, tâches, livraisons", icon: KanbanSquare, color: "text-violet-400", bg: "bg-violet-400/10" },
  { slug: "finance", label: "Finance", description: "Devis, factures, dépenses", icon: BarChart3, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { slug: "admin", label: "Admin", description: "Abonnements, base de connaissances", icon: Settings2, color: "text-amber-400", bg: "bg-amber-400/10" },
  { slug: "agenda", label: "Agenda & IA", description: "Calendrier et rappels intelligents", icon: CalendarDays, color: "text-rose-400", bg: "bg-rose-400/10" },
];

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

async function getStats() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [pipeline, activeProjects, unpaid, paidMonth, reminders] = await Promise.all([
      prisma.prospect.count({ where: { status: { notIn: ["WON", "LOST", "ARCHIVED"] } } }),
      prisma.project.count({ where: { status: { notIn: ["COMPLETED", "ON_HOLD"] } } }),
      prisma.invoice.findMany({
        where: { status: { in: ["PENDING", "OVERDUE"] } },
        select: { id: true, number: true, totalHT: true, dueAt: true, prospect: { select: { name: true } } },
        orderBy: { dueAt: "asc" },
      }),
      prisma.invoice.aggregate({ _sum: { totalHT: true }, where: { status: "PAID", paidAt: { gte: monthStart } } }),
      prisma.reminder.findMany({
        where: { status: "PENDING", dueAt: { lte: new Date(now.getTime() + 24 * 3600 * 1000) } },
        include: { prospect: { select: { id: true, name: true } } },
        orderBy: { dueAt: "asc" },
        take: 6,
      }),
    ]);
    return { pipeline, activeProjects, unpaid, paidMonth: paidMonth._sum.totalHT ?? 0, reminders };
  } catch {
    return null;
  }
}

function Kpi({ label, value, hint, tone = "text-foreground" }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tracking-tight tabular ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function Home() {
  const stats = await getStats();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 18 ? "Bonjour" : "Bonsoir";
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const overdue = stats?.unpaid.filter((i) => i.dueAt < now) ?? [];
  const unpaidTotal = stats?.unpaid.reduce((s, i) => s + i.totalHT, 0) ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 md:px-8 py-8 max-w-5xl mx-auto w-full space-y-8">
        <header>
          <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{greeting} Pierre</h1>
        </header>

        {stats ? (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="Prospects en pipeline" value={stats.pipeline} />
              <Kpi label="Projets actifs" value={stats.activeProjects} />
              <Kpi label="Encaissé ce mois" value={eur(stats.paidMonth)} tone="text-emerald-400" />
              <Kpi
                label="À encaisser"
                value={eur(unpaidTotal)}
                tone={overdue.length ? "text-amber-400" : "text-foreground"}
                hint={overdue.length ? `${overdue.length} en retard` : `${stats.unpaid.length} facture${stats.unpaid.length > 1 ? "s" : ""}`}
              />
            </section>

            <section className="grid md:grid-cols-2 gap-3">
              <div className="surface p-4">
                <h2 className="flex items-center gap-2 text-sm font-medium mb-3">
                  <Bell size={14} className="text-primary" /> Rappels du jour
                </h2>
                {stats.reminders.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Rien d&apos;urgent 🎉</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.reminders.map((r) => (
                      <li key={r.id}>
                        <Link href={`/crm/${r.prospect.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary transition-colors">
                          <span className="truncate">{r.note}</span>
                          <span className={`shrink-0 text-xs ${r.dueAt < now ? "text-red-400" : "text-muted-foreground"}`}>{r.prospect.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="surface p-4">
                <h2 className="flex items-center gap-2 text-sm font-medium mb-3">
                  <Euro size={14} className="text-primary" /> Factures en attente
                </h2>
                {stats.unpaid.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Tout est encaissé.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.unpaid.slice(0, 5).map((i) => (
                      <li key={i.id}>
                        <Link href="/finance" className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary transition-colors">
                          <span className="truncate flex items-center gap-1.5">
                            {i.dueAt < now && <AlertTriangle size={12} className="text-red-400 shrink-0" />}
                            {i.prospect.name} <span className="text-xs text-muted-foreground">{i.number}</span>
                          </span>
                          <span className="shrink-0 tabular">{eur(i.totalHT)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        ) : null}

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Modules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.map(({ slug, label, description, icon: Icon, color, bg }) => (
              <Link key={slug} href={`/${slug}`} className="group surface surface-hover flex items-center gap-3.5 p-4">
                <div className={`size-10 shrink-0 rounded-xl grid place-items-center ${bg} ${color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
                </div>
                <ArrowRight size={15} className="shrink-0 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
