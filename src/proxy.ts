import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight gate: presence of a session cookie decides page access.
 * Real session verification happens server-side (RSC + server actions),
 * so a forged cookie gets pages that fail their data loads, not data.
 */
export function proxy(request: NextRequest) {
  // Skip during build/prerender
  if (process.env["NODE_ENV"] !== "production") {
    return NextResponse.next();
  }
  
  // Demo mode: skip sign-in gate when explicitly enabled (see src/lib/session.ts).
  if (process.env["DEV_BYPASS_AUTH"] === "true") {
    return NextResponse.next();
  }
  const hasSession = Boolean(getSessionCookie(request));
  if (!hasSession) {
    // Avoid redirect loop: don't redirect if already going to sign-in
    if (request.nextUrl.pathname.startsWith("/sign-in")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/board/:path*", "/settings/:path*"],
};
