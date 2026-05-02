import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/parse-ai-json";
import { MODEL_HAIKU } from "@/config";

export async function POST(request: NextRequest) {
  const { emailId } = await request.json();

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { prospect: true },
  });

  if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

  const message = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Analyse cet email reçu d'un prospect pour DeepShift (auto-entreprise IT — web apps sur mesure, consulting digital).

Prospect : ${email.prospect.name}${email.prospect.company ? ` (${email.prospect.company})` : ""}
Sujet : ${email.subject}
Contenu :
${email.body}

Réponds UNIQUEMENT en JSON :
{
  "summary": "résumé court en 1-2 phrases",
  "intent": "INTERESTED | NOT_INTERESTED | NEEDS_INFO | CALLBACK",
  "recommended_action": "action concrète à faire"
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseAiJson<{ summary?: string; intent?: string; recommended_action?: string }>(raw, "emails-analyze") ?? {};

  const updated = await prisma.email.update({
    where: { id: emailId },
    data: {
      aiAnalysis: parsed.summary ?? null,
      aiIntent: parsed.intent ?? null,
    },
  });

  return NextResponse.json({ ...updated, recommended_action: parsed.recommended_action });
}
