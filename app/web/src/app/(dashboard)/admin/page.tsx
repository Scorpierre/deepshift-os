import { Settings2 } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center p-10">
      <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400">
        <Settings2 size={28} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Admin & Interne</h1>
      <p className="text-muted-foreground text-sm">Module en cours de développement.</p>
    </div>
  );
}
