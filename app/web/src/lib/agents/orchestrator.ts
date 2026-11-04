import type Anthropic from "@anthropic-ai/sdk";
import { MODEL_SONNET } from "@/config";
import { runAgentLoop } from "./runner";
import { salesAgent } from "./sales";
import { projectManagerAgent } from "./project-manager";
import { financialAgent } from "./financial";
import { secretaryAgent } from "./secretary";
import type { AgentSpec, AgentTool } from "./types";

export const AGENTS: AgentSpec[] = [salesAgent, projectManagerAgent, financialAgent, secretaryAgent];

/** Chaque sous-agent est exposé à l'orchestrateur comme un outil `ask_<nom>`. */
function delegationTool(agent: AgentSpec): AgentTool {
  return {
    def: {
      name: `ask_${agent.name}`,
      description: `${agent.description} Donne une tâche autonome et précise, avec tout le contexte nécessaire.`,
      input_schema: {
        type: "object",
        properties: { task: { type: "string", description: "La tâche à réaliser, formulée de façon autonome." } },
        required: ["task"],
      },
    },
    run: async ({ task }) =>
      runAgentLoop({
        model: agent.model,
        system: agent.system,
        tools: agent.tools,
        messages: [{ role: "user", content: String(task) }],
      }),
  };
}

const ORCHESTRATOR_SYSTEM =
  "Tu es l'agent principal de DeepShift OS, l'assistant de Pierre qui pilote son auto-entreprise IT. " +
  "Tu ne touches pas aux données toi-même : tu délègues à quatre agents spécialisés — Sales (CRM), Project Manager (projets), Financial (finance), Secrétaire (agenda/emails). " +
  "Appelle plusieurs agents dans le même tour quand les demandes sont indépendantes (ex: point global du jour). " +
  "Pour une question simple hors périmètre, réponds directement. Synthétise leurs retours en une réponse claire en français, sans mentionner la mécanique interne de délégation. " +
  `Date du jour : ${new Date().toISOString().slice(0, 10)}.`;

export async function runOrchestrator(messages: Anthropic.MessageParam[]): Promise<string> {
  return runAgentLoop({
    model: MODEL_SONNET,
    system: ORCHESTRATOR_SYSTEM,
    tools: AGENTS.map(delegationTool),
    messages,
    maxTokens: 3000,
  });
}
