import { BarChart3 } from "lucide-react";

export default function FinancePage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center p-10">
      <div className="p-4 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400">
        <BarChart3 size={28} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
      <p className="text-muted-foreground text-sm">Module en cours de développement.</p>
    </div>
  );
}
