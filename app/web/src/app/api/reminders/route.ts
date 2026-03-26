import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReminderType } from "@prisma/client";

export async function GET() {
  const reminders = await prisma.reminder.findMany({
    where: { status: "PENDING" },
    include: { prospect: { select: { id: true, name: true, company: true } } },
    orderBy: { dueAt: "asc" },
  });

  return NextResponse.json(reminders);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const reminder = await prisma.reminder.create({
    data: {
      prospectId: body.prospectId,
      dueAt: new Date(body.dueAt),
      note: body.note,
      type: (body.type ?? "CUSTOM") as ReminderType,
    },
  });

  return NextResponse.json(reminder, { status: 201 });
}
