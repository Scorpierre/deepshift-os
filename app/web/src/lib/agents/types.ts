import type Anthropic from "@anthropic-ai/sdk";

export type AgentTool = {
  def: Anthropic.Tool;
  run: (input: Record<string, unknown>) => Promise<unknown>;
};

export type AgentSpec = {
  name: "sales" | "project_manager" | "financial" | "secretary";
  /** Ce que l'orchestrateur voit pour décider de déléguer. */
  description: string;
  system: string;
  model: string;
  tools: AgentTool[];
};
