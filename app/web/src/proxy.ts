import { NextRequest, NextResponse } from "next/server";
import { sessionToken } from "@/lib/session";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/webhooks/n8n",
  "/api/webhooks/gmail-poll",
  "/api/cron/daily-outreach",
  "/api/cron/process-followups",
  "/api/cron/monthly-claude-expense",
  "/api/cron/monthly-azure-expense",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get("session")?.value;

  if (!session || session !== sessionToken()) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
