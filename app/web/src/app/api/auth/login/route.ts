import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

function sessionToken(): string {
  const secret = process.env.APP_SECRET!;
  return createHmac("sha256", secret).update("session").digest("hex");
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // secure: true, // décommenter en production HTTPS
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
  return res;
}
