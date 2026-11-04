import { DEMO_AGENTS, type DemoAgentName } from "./agents";

export type TraceStep = { agent: DemoAgentName; label: string; task: string; result: string };
export type OrchestratorResult = { reply: string; trace: TraceStep[] };

/** Orchestrateur de démo : routage par mots-clés, aucun appel à Claude. */
export async function runDemoOrchestrator(question: string): Promise<OrchestratorResult> {
  const names = Object.keys(DEMO_AGENTS) as DemoAgentName[];
  let picked = names.filter((n) => DEMO_AGENTS[n].keywords.test(question));
  if (/point|bilan|résumé|resume|journée|journee|aujourd|global|tout/i.test(question) || picked.length === 0) {
    picked = names; // demande générale → les 4 agents
  }

  await new Promise((r) => setTimeout(r, 400 + picked.length * 250)); // latence réaliste

  const trace: TraceStep[] = picked.map((agent) => ({
    agent,
    label: DEMO_AGENTS[agent].label,
    task: question,
    result: DEMO_AGENTS[agent].answer(question),
  }));

  const reply =
    trace.length === 1
      ? trace[0].result
      : trace.map((t) => `── ${t.label} ──\n${t.result}`).join("\n\n");
  return { reply, trace };
}
