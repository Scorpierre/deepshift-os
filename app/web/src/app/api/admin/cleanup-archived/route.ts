import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Endpoint temporaire — à supprimer après usage
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.ADMIN_CLEANUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prospects = await prisma.prospect.findMany({
    where: { status: { in: ["ARCHIVED", "LOST"] } },
    select: { id: true, name: true, company: true, email: true, status: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ count: prospects.length, prospects });
}

export async function DELETE(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.ADMIN_CLEANUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await prisma.prospect.deleteMany({
    where: { status: { in: ["ARCHIVED", "LOST"] } },
  });

  return NextResponse.json({ deleted: count });
}
