"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  KanbanSquare,
  BarChart3,
  Settings2,
  CalendarDays,
  LayoutDashboard,
  Building2,
  Bot,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const groups = [
  {
    label: null,
    items: [
      { slug: "/", label: "Accueil", icon: LayoutDashboard },
      { slug: "/assistant", label: "Assistant", icon: Bot },
    ],
  },
  {
    label: "Commercial",
    items: [
      { slug: "/crm", label: "CRM", icon: Users },
      { slug: "/clients", label: "Clients", icon: Building2 },
    ],
  },
  {
    label: "Production",
    items: [
      { slug: "/projets", label: "Projets", icon: KanbanSquare },
      { slug: "/agenda", label: "Agenda & IA", icon: CalendarDays },
    ],
  },
  {
    label: "Gestion",
    items: [
      { slug: "/finance", label: "Finance", icon: BarChart3 },
      { slug: "/admin", label: "Admin", icon: Settings2 },
    ],
  },
];

function isActive(slug: string, pathname: string) {
  return slug === "/" ? pathname === "/" : pathname === slug || pathname.startsWith(slug + "/");
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 px-3 h-14 shrink-0">
        <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-violet-400 grid place-items-center text-[13px] font-bold text-white shadow-lg shadow-primary/30">
          D
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">DeepShift</p>
          <p className="text-[10px] text-muted-foreground">Operating system</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {groups.map((g, i) => (
          <div key={i} className="space-y-0.5">
            {g.label && (
              <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {g.label}
              </p>
            )}
            {g.items.map(({ slug, label, icon: Icon }) => {
              const active = isActive(slug, pathname);
              return (
                <Link
                  key={slug}
                  href={slug}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                    active
                      ? "bg-primary/15 text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-primary" />
                  )}
                  <Icon size={16} className={active ? "text-primary" : ""} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border shrink-0">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-sidebar flex-col">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          />
          <aside className="relative w-64 bg-sidebar border-r border-border flex flex-col animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer le menu"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X size={16} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-12 border-b border-border bg-sidebar shrink-0">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-semibold tracking-tight">DeepShift</span>
        </div>
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
