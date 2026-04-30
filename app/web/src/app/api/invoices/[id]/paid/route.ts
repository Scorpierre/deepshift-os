import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const invoice = await prisma.invoice.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() },
    include: {
      prospect: { select: { id: true, name: true, company: true, email: true } },
    },
  });

  return NextResponse.json(invoice);
}
