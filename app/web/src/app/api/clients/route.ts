import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Liste tous les prospects avec au moins un projet (clients actifs ou passés).
 * Inclut aussi les prospects WON sans projet encore.
 */
export async function GET() {
  const clients = await prisma.prospect.findMany({
    where: {
      OR: [
        { status: "WON" },
        { projects: { some: {} } },
      ],
    },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      status: true,
      projects: {
        select: {
          id: true,
          name: true,
          status: true,
          budget: true,
          deadline: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}
