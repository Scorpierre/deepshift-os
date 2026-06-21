"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, ChevronRight, ExternalLink, Loader2, Plus,
  CheckCircle2, Circle, Wrench,
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
  BRIEF: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  IN_PROGRESS: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  REVIEW: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  DELIVERED: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  COMPLETED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  MAINTENANCE: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  ON_HOLD: "bg-zinc-500/20 text-zinc-500 border-zinc-500/20",
};

function projectIcon(status: ProjectStatus) {
  if (status === "COMPLETED") return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />;
  if (status === "MAINTENANCE") return <Wrench size={13} className="text-violet-400 shrink-0" />;
  if (status === "ON_HOLD") return <Circle size={13} className="text-zinc-500 shrink-0" />;
  return <Circle size={13} className="text-blue-400 shrink-0" />;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetch("/api/clients").then((r) => r.json());
    setClients(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
        <h1 className="font-semibold text-sm">
          Clients
          {clients.length > 0 && (
            <span className="ml-2 text-[10px] text-muted-foreground font-normal">
              {clients.length} client{clients.length > 1 ? "s" : ""}
            </span>
          )}
        </h1>
        <button
          onClick={() => router.push("/crm")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/80 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={12} /> Nouveau prospect
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/40 gap-2">
            <Building2 size={36} strokeWidth={1.5} />
            <p className="text-sm">Aucun client pour l'instant.</p>
            <p className="text-xs">Les prospects passés en WON apparaissent ici.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {clients.map((client) => {
              const activeProjects = client.projects.filter(
                (p) => !["COMPLETED", "ON_HOLD"].includes(p.status)
              );
              const totalRevenue = client.projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);

              return (
                <div key={client.id} className="px-5 py-4 space-y-3">
                  {/* Client header */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{client.name}</span>
                        {client.company && (
                          <span className="text-xs text-muted-foreground truncate">— {client.company}</span>
                        )}
                        {activeProjects.length > 0 && (
                          <span className="text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full shrink-0">
                            {activeProjects.length} actif{activeProjects.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{client.email}</span>
                        {totalRevenue > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {totalRevenue.toLocaleString("fr-FR")} € CA total
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/crm/${client.id}`)}
                      className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/60 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <ExternalLink size={11} /> Fiche
                    </button>
                    <button
                      onClick={() => router.push(`/projets?client=${client.id}`)}
                      className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/60 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus size={11} /> Projet
                    </button>
                  </div>

                  {/* Projects list */}
                  {client.projects.length > 0 ? (
                    <div className="ml-0 space-y-1">
                      {client.projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => router.push(`/projets/${project.id}`)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 bg-muted/20 hover:bg-muted/40 rounded-xl transition-colors text-left group"
                        >
                          {projectIcon(project.status)}
                          <span className="flex-1 text-xs truncate">{project.name}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[project.status]}`}>
                            {STATUS_LABELS[project.status]}
                          </span>
                          {project.budget && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {project.budget.toLocaleString("fr-FR")} €
                            </span>
                          )}
                          <ChevronRight size={11} className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/40 ml-0">Aucun projet associé.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
