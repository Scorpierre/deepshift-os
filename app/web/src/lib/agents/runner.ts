import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import type { AgentTool } from "./types";

const MAX_TURNS = 8;

type RunParams = {
  model: string;
  system: string;
  tools: AgentTool[];
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
};

/** Boucle tool-use générique, partagée par l'orchestrateur et les 4 agents. */
export async function runAgentLoop({ model, system, tools, messages, maxTokens = 2048 }: RunParams): Promise<string> {
  const history = [...messages];
  const byName = new Map(tools.map((t) => [t.def.name, t]));

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = (await anthropic.messages.create({
      model,
      system,
      max_tokens: maxTokens,
      tools: tools.map((t) => t.def),
      messages: history,
    })) as Anthropic.Message;

    history.push({ role: "assistant", content: res.content });

    const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    }

    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (u) => {
        const tool = byName.get(u.name);
        try {
          if (!tool) throw new Error(`Outil inconnu: ${u.name}`);
          const out = await tool.run(u.input as Record<string, unknown>);
          return { type: "tool_result" as const, tool_use_id: u.id, content: JSON.stringify(out ?? null) };
        } catch (e) {
          return {
            type: "tool_result" as const,
            tool_use_id: u.id,
            is_error: true,
            content: e instanceof Error ? e.message : String(e),
          };
        }
      })
    );
    history.push({ role: "user", content: results });
  }
  return "Limite d'itérations atteinte avant de pouvoir conclure.";
}
