import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Retourne les emails avec une date de RDV proposée non encore confirmée
export async function GET() {
  const proposals = await prisma.email.findMany({
    where: {
      aiMeetingDate: { not: null },
      meetingEventId: null,
    },
    include: {
      prospect: { select: { id: true, name: true, company: true } },
    },
    orderBy: { aiMeetingDate: "asc" },
  });

  return NextResponse.json(proposals);
}
