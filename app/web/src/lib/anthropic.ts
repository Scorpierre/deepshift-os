import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// USD per token by model
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":         { input: 3 / 1e6,    output: 15 / 1e6 },
  "claude-haiku-4-5-20251001": { input: 0.25 / 1e6, output: 1.25 / 1e6 },
  "claude-opus-4-7":           { input: 15 / 1e6,   output: 75 / 1e6 },
};

function computeCost(model: string, input: number, output: number): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  return input * p.input + output * p.output;
}

export const anthropic = {
  messages: {
    create: async (params: Parameters<typeof client.messages.create>[0]) => {
      const res = await client.messages.create(params);
      if ("usage" in res) {
        const costUsd = computeCost(params.model, res.usage.input_tokens, res.usage.output_tokens);
        console.log(
          `[claude] model=${params.model} in=${res.usage.input_tokens} out=${res.usage.output_tokens} cost=$${costUsd.toFixed(6)}`
        );
        prisma.aiUsageLog
          .create({
            data: {
              model: params.model,
              inputTokens: res.usage.input_tokens,
              outputTokens: res.usage.output_tokens,
              costUsd,
            },
          })
          .catch(() => {});
      }
      return res;
    },
  },
} as unknown as Anthropic;
