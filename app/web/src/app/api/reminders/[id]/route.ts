import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const VALID_REMINDER_STATUSES = ["PENDING", "DONE", "SNOOZED"] as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  if (body.status !== undefined && !VALID_REMINDER_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  try {
    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.dueAt && { dueAt: new Date(body.dueAt) }),
        ...(body.note !== undefined && { note: body.note }),
      },
    });
    return NextResponse.json(reminder);
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }
    console.error("[PATCH /api/reminders/[id]]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
