import { KanbanSquare } from "lucide-react";

export default function ProjetsPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center p-10">
      <div className="p-4 rounded-2xl bg-violet-400/10 border border-violet-400/20 text-violet-400">
        <KanbanSquare size={28} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
      <p className="text-muted-foreground text-sm">Module en cours de développement.</p>
    </div>
  );
}
