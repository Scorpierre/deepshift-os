import Link from "next/link";
import {
  Users,
  KanbanSquare,
  BarChart3,
  Settings2,
  CalendarDays,
  ArrowRight,
} from "lucide-react";

const modules = [
  {
    slug: "crm",
    label: "CRM & Prospection",
    description: "Pipeline prospects, scoring IA, relances automatiques",
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
  },
  {
    slug: "projets",
    label: "Projets",
    description: "Kanban, tâches, suivi temps, comptes-rendus Claude",
    icon: KanbanSquare,
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/20",
  },
  {
    slug: "finance",
    label: "Finance",
    description: "Devis, factures, suivi CA, relances paiement",
    icon: BarChart3,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  },
  {
    slug: "admin",
    label: "Admin & Interne",
    description: "Abonnements, base de connaissances, weekly review",
    icon: Settings2,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
  },
  {
    slug: "agenda",
    label: "Agenda & IA",
    description: "Calendrier, rappels intelligents, chat Claude",
    icon: CalendarDays,
    color: "text-rose-400",
    bg: "bg-rose-400/10 border-rose-400/20",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen px-6 py-10 max-w-4xl mx-auto w-full">
      <header className="mb-12">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
          DeepShift OS
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bienvenue Pierre — choisissez un module.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.slug}
              href={`/${mod.slug}`}
              className={`group flex items-start gap-4 rounded-xl border p-5 transition-colors hover:bg-card ${mod.bg}`}
            >
              <div className={`mt-0.5 shrink-0 ${mod.color}`}>
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight">{mod.label}</p>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  {mod.description}
                </p>
              </div>
              <ArrowRight
                size={16}
                className="shrink-0 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
