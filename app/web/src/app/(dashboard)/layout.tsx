"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  KanbanSquare,
  BarChart3,
  Settings2,
  CalendarDays,
  LayoutDashboard,
  Building2,
} from "lucide-react";

const nav = [
  { slug: "/", label: "Accueil", icon: LayoutDashboard },
  { slug: "/crm", label: "CRM", icon: Users },
  { slug: "/clients", label: "Clients", icon: Building2 },
  { slug: "/projets", label: "Projets", icon: KanbanSquare },
  { slug: "/finance", label: "Finance", icon: BarChart3 },
  { slug: "/admin", label: "Admin", icon: Settings2 },
  { slug: "/agenda", label: "Agenda & IA", icon: CalendarDays },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-52 shrink-0 border-r border-border flex flex-col py-6 px-3 gap-1 overflow-y-auto">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest px-3 mb-4">
          DeepShift OS
        </p>
        {nav.map(({ slug, label, icon: Icon }) => {
          const active = slug !== "/" && pathname === slug;
          return (
            <Link
              key={slug}
              href={slug}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
