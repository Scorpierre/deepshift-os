"use client";

import { useRef, useState } from "react";
import { Bot, Loader2, Send, ChevronDown } from "lucide-react";

type Step = { agent: string; label: string; result: string };
type Msg = { role: "user" | "assistant"; content: string; trace?: Step[]; mode?: string };

const AGENT_COLORS: Record<string, string> = {
  sales: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  project_manager: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  financial: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  secretary: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

const SUGGESTIONS = [
  "Fais-moi le point de la journée",
  "Où en est mon pipeline ?",
  "Quels projets sont en retard ?",
  "Quelles factures sont impayées ?",
  "Quel est mon agenda cette semaine ?",
  "Rédige un brouillon de réponse à Marchand",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [engine, setEngine] = useState<"code" | "n8n">("code");
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? data.error ?? "Erreur", trace: data.trace, mode: data.mode }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Erreur réseau." }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-primary/20 text-primary"><Bot className="size-5" /></div>
        <div>
          <h1 className="text-lg font-semibold">Assistant DeepShift</h1>
          <p className="text-xs text-muted-foreground">
            {engine === "code"
              ? "Agent principal → Sales · Project Manager · Financial · Secrétaire — agents en code"
              : "Agent Sales orchestré par un workflow n8n (Claude Haiku + outil CRM)"}
          </p>
        </div>
        <div className="ml-auto flex rounded-lg border border-white/10 p-0.5 text-xs">
          {([["code", "Agents code"], ["n8n", "Agent n8n"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setEngine(k)} className={`rounded-md px-3 py-1.5 ${engine === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-white/10 p-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-6 text-center">
            <p className="text-sm text-muted-foreground">Essayez une de ces demandes :</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[90%] space-y-2 rounded-xl px-4 py-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-white/5"}`}>
              {m.trace && m.trace.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ChevronDown className="size-3" /> délégué à
                  {m.trace.map((t) => (
                    <span key={t.agent} className={`rounded-full border px-2 py-0.5 ${AGENT_COLORS[t.agent]}`}>{t.label}</span>
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> {engine === "n8n" ? "Le workflow n8n travaille…" : "Les agents travaillent…"}</div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Demandez quelque chose à votre équipe d'agents…"
          className="flex-1 rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button disabled={loading || !input.trim()} className="grid w-11 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
