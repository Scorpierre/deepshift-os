import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const reminder = await prisma.reminder.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status as string }),
      ...(body.dueAt && { dueAt: new Date(body.dueAt) }),
      ...(body.note !== undefined && { note: body.note }),
    },
  });

  return NextResponse.json(reminder);
}
