import { NextRequest, NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/agents/orchestrator";
import { runDemoOrchestrator } from "@/lib/agents/demo/orchestrator";

export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

// Démo par défaut (données fictives, sans appel Claude). AGENTS_MODE=live pour activer les vrais agents.
const LIVE = process.env.AGENTS_MODE === "live";

// Agent Sales hébergé sur n8n (workflow n8n/sales-agent-chat.json, chat trigger public).
const N8N_AGENT_URL = process.env.N8N_AGENT_URL ?? "http://localhost:5679/webhook/deepshift-sales-agent/chat";

export async function POST(req: NextRequest) {
  const { messages, engine } = (await req.json()) as { messages?: ChatMessage[]; engine?: "code" | "n8n" };
  if (!Array.isArray(messages) || messages.length === 0 || messages.at(-1)?.role !== "user") {
    return NextResponse.json({ error: "messages invalide" }, { status: 400 });
  }
  if (engine === "n8n") {
    try {
      const res = await fetch(N8N_AGENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendMessage", sessionId: "deepshift-assistant", chatInput: messages.at(-1)!.content }),
        signal: AbortSignal.timeout(55_000),
      });
      if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);
      const data = (await res.json()) as { output?: string };
      return NextResponse.json({ mode: "n8n", reply: data.output ?? "Réponse vide de n8n.", trace: [] });
    } catch (e) {
      console.error("[agent/chat] n8n:", e);
      return NextResponse.json({ error: "Agent n8n injoignable — vérifie que n8n tourne et que le workflow est actif." }, { status: 502 });
    }
  }
  if (!LIVE) {
    return NextResponse.json({ mode: "demo", ...(await runDemoOrchestrator(messages.at(-1)!.content)) });
  }
  const reply = await runOrchestrator(messages.slice(-20));
  return NextResponse.json({ mode: "live", reply, trace: [] });
}
