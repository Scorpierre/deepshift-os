export function parseAiJson<T>(raw: string, context: string): T | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) {
    console.warn(`[parseAiJson:${context}] no JSON object found in response`);
    return null;
  }
  try {
    return JSON.parse(match[0]) as T;
  } catch (err) {
    console.warn(`[parseAiJson:${context}] parse error:`, err);
    return null;
  }
}
