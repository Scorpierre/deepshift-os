import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { analyzeProspect } from "@/lib/analyze-prospect";

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

const VALID_STATUSES = [
  "NEW", "SCORING", "SCORED", "VIP",
  "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST", "ARCHIVED",
] as const;
type ProspectStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validation
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as ProspectStatus)) {
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
  }
  if (body.score !== undefined) {
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 0 || score > 10) {
      return NextResponse.json({ error: "score must be an integer between 0 and 10" }, { status: 400 });
    }
    body.score = score;
  }

  let prospect;
  try {
    prospect = await prisma.prospect.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name as string }),
        ...(body.company !== undefined && { company: body.company as string }),
        ...(body.email !== undefined && { email: body.email as string }),
        ...(body.phone !== undefined && { phone: body.phone as string }),
        ...(body.linkedinUrl !== undefined && { linkedinUrl: body.linkedinUrl as string }),
        ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl as string }),
        ...(body.status !== undefined && { status: body.status as ProspectStatus }),
        ...(body.score !== undefined && { score: body.score as number }),
        ...(body.needType !== undefined && { needType: body.needType as string[] }),
        ...(body.estimatedBudget !== undefined && { estimatedBudget: body.estimatedBudget as number }),
        ...(body.source !== undefined && { source: body.source as string }),
        ...(body.lastContactedAt !== undefined && { lastContactedAt: body.lastContactedAt ? new Date(body.lastContactedAt as string) : null }),
        ...(body.nextActionAt !== undefined && { nextActionAt: body.nextActionAt ? new Date(body.nextActionAt as string) : null }),
        ...(body.nextActionNote !== undefined && { nextActionNote: body.nextActionNote as string }),
        ...(body.companyDescription !== undefined && { companyDescription: body.companyDescription as string }),
        ...(body.prospectNotes !== undefined && { prospectNotes: body.prospectNotes as string | null }),
        // Champs AI : en lecture seule via ce endpoint
      },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    throw err;
  }

  // Re-déclenche n8n si une URL vient d'être ajoutée ou modifiée
  const urlChanged = body.websiteUrl !== undefined || body.linkedinUrl !== undefined;
  if (urlChanged && (prospect.websiteUrl || prospect.linkedinUrl)) {
    waitUntil(analyzeProspect(prospect.id).catch((err) => console.error("[PATCH /api/prospects] analyzeProspect failed:", err)));
  }

  return NextResponse.json(prospect);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.prospect.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("[DELETE /api/prospects]", err);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}
