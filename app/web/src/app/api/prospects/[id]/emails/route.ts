import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const emails = await prisma.email.findMany({
    where: { prospectId: id },
    orderBy: { sentAt: "desc" },
  });

  return NextResponse.json(emails);
}
