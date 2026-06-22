"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Loader2, ExternalLink } from "lucide-react";

type Prospect = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  status: "LOST" | "ARCHIVED";
  score: number | null;
  aiScoreReason: string | null;
  source: string | null;
  createdAt: string;
};

function scoreColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 8) return "text-violet-400";
  if (score >= 4) return "text-sky-400";
  return "text-red-400";
}

export default function ArchivesPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    router.refresh();
    fetch("/api/prospects?status=LOST,ARCHIVED")
      .then((r) => r.json())
      .then((data: Prospect[]) => {
        setProspects(data.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
        setLoading(false);
      });
  }, [router]);

  async function deleteOne(id: string) {
    setDeleting((prev) => new Set(prev).add(id));
    const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProspects((prev) => prev.filter((p) => p.id !== id));
      setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } else {
      alert("Erreur lors de la suppression. Réessaie.");
    }
    setDeleting((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    setDeletingAll(true);
    try {
      const ids = [...selected];
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/prospects/${id}`, { method: "DELETE" }).then(r => ({ id, ok: r.ok })))
      );
      const succeeded = new Set(
        results.flatMap(r => r.status === "fulfilled" && r.value.ok ? [r.value.id] : [])
      );
      setProspects((prev) => prev.filter((p) => !succeeded.has(p.id)));
      setSelected((prev) => {
        const s = new Set(prev);
        succeeded.forEach((id) => s.delete(id));
        return s;
      });
      const failed = ids.length - succeeded.size;
      if (failed > 0) alert(`${failed} suppression(s) ont échoué.`);
    } finally {
      setDeletingAll(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function toggleAll() {
    if (selected.size === prospects.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(prospects.map((p) => p.id)));
    }
  }

  const lostCount = prospects.filter((p) => p.status === "LOST").length;
  const archivedCount = prospects.filter((p) => p.status === "ARCHIVED").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/crm"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1 rounded"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-base font-semibold tracking-tight">Archivés & Perdus</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "Chargement…" : (
                <>
                  {archivedCount > 0 && <span>{archivedCount} archivé{archivedCount > 1 ? "s" : ""}</span>}
                  {archivedCount > 0 && lostCount > 0 && <span className="mx-1">·</span>}
                  {lostCount > 0 && <span>{lostCount} perdu{lostCount > 1 ? "s" : ""}</span>}
                  {archivedCount === 0 && lostCount === 0 && <span>Aucun prospect</span>}
                </>
              )}
            </p>
          </div>
        </div>

        {selected.size > 0 && (
          <button
            onClick={deleteSelected}
            disabled={deletingAll}
            className="flex items-center gap-2 text-sm bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition-colors"
          >
            {deletingAll ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Supprimer {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : prospects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-muted-foreground text-sm">Aucun prospect archivé ou perdu.</p>
          <Link href="/crm" className="text-xs text-primary hover:underline">← Retour au CRM</Link>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === prospects.length && prospects.length > 0}
                    onChange={toggleAll}
                    className="accent-primary"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prospect</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Raison IA</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Ajouté le</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {prospects.map((p) => (
                <tr
                  key={p.id}
                  className={`transition-colors ${selected.has(p.id) ? "bg-red-500/5" : "hover:bg-muted/30"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    {p.company && <p className="text-xs text-muted-foreground">{p.company}</p>}
                    <p className="text-xs text-muted-foreground/60">{p.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === "LOST"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-zinc-500/10 text-zinc-400"
                    }`}>
                      {p.status === "LOST" ? "Perdu" : "Archivé"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold text-sm ${scoreColor(p.score)}`}>
                      {p.score ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-xs text-muted-foreground max-w-xs truncate">
                      {p.aiScoreReason ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/crm/${p.id}`}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Voir la fiche"
                      >
                        <ExternalLink size={13} />
                      </Link>
                      <button
                        onClick={() => deleteOne(p.id)}
                        disabled={deleting.has(p.id)}
                        className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                        title="Supprimer"
                      >
                        {deleting.has(p.id)
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
