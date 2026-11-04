"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/");
    } else {
      setError("Mot de passe incorrect.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm surface p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="size-12 rounded-xl bg-gradient-to-br from-primary to-violet-400 grid place-items-center text-lg font-bold text-white shadow-lg shadow-primary/30 mb-4">
            D
          </div>
          <h1 className="text-xl font-semibold tracking-tight">DeepShift OS</h1>
          <p className="text-sm text-muted-foreground mt-1">Connectez-vous pour continuer</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              autoFocus
              required
              aria-invalid={!!error}
              className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/60 placeholder:text-muted-foreground/50"
            />
          </div>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Vérification…" : "Entrer"}
          </button>
        </form>
      </div>
    </div>
  );
}
