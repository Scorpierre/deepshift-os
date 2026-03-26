import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triggerN8nAnalysis } from "@/lib/n8n";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: {
      emails: { orderBy: { sentAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      reminders: { orderBy: { dueAt: "asc" } },
    },
  });

  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(prospect);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const prospect = await prisma.prospect.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.company !== undefined && { company: body.company }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.linkedinUrl !== undefined && { linkedinUrl: body.linkedinUrl }),
      ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.score !== undefined && { score: body.score }),
      ...(body.needType !== undefined && { needType: body.needType }),
      ...(body.estimatedBudget !== undefined && { estimatedBudget: body.estimatedBudget }),
      ...(body.source !== undefined && { source: body.source }),
      ...(body.lastContactedAt !== undefined && { lastContactedAt: body.lastContactedAt ? new Date(body.lastContactedAt) : null }),
      ...(body.nextActionAt !== undefined && { nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null }),
      ...(body.nextActionNote !== undefined && { nextActionNote: body.nextActionNote }),
      ...(body.companyDescription !== undefined && { companyDescription: body.companyDescription }),
      ...(body.aiSummary !== undefined && { aiSummary: body.aiSummary }),
      ...(body.aiScoreReason !== undefined && { aiScoreReason: body.aiScoreReason }),
    },
    include: {
      emails: { orderBy: { sentAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      reminders: { orderBy: { dueAt: "asc" } },
    },
  });

  // Re-déclenche n8n si une URL vient d'être ajoutée ou modifiée
  const urlChanged = body.websiteUrl !== undefined || body.linkedinUrl !== undefined;
  if (urlChanged && (prospect.websiteUrl || prospect.linkedinUrl)) {
    triggerN8nAnalysis(prospect);
  }

  return NextResponse.json(prospect);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  await prisma.prospect.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
