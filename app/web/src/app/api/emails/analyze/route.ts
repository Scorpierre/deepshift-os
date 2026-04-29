import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { emailId } = await request.json();

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { prospect: true },
  });

  if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
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

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  let parsed: { summary?: string; intent?: string; recommended_action?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // parsing failed, keep empty
  }

  const updated = await prisma.email.update({
    where: { id: emailId },
    data: {
      aiAnalysis: parsed.summary ?? null,
      aiIntent: parsed.intent ?? null,
    },
  });

  return NextResponse.json({ ...updated, recommended_action: parsed.recommended_action });
}
