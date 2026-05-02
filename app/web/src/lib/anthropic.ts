import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const anthropic = {
  messages: {
    create: async (params: Parameters<typeof client.messages.create>[0]) => {
      const res = await client.messages.create(params);
      if ("usage" in res) {
        console.log(
          `[claude] model=${params.model} in=${res.usage.input_tokens} out=${res.usage.output_tokens}`
        );
      }
      return res;
    },
  },
} as unknown as Anthropic;
