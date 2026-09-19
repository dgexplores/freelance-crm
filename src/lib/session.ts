import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export const DEV_BYPASS_EMAIL = "dev@local.test";

/** Dev/demo bypass. Enabled ONLY with DEV_BYPASS_AUTH=true. Do NOT set in real prod. */
function devBypassEnabled() {
  if (process.env["DEV_BYPASS_AUTH"] !== "true") return false;
  if (process.env["NODE_ENV"] === "production") {
    console.warn("[auth] DEV_BYPASS_AUTH enabled in production – demo mode, data is public.");
  }
  return true;
}

/**
 * Returns the session user or null if not authenticated.
 * Use with middleware for protected routes.
 * Dev mode (DEV_BYPASS_AUTH=true, non-production): returns a local dev user,
 * auto-created on first use, so /board + /settings render without Google OAuth.
 */
export async function getUser() {
  if (devBypassEnabled()) {
    const user = await prisma.user.upsert({
      where: { email: DEV_BYPASS_EMAIL },
      update: {},
      create: { email: DEV_BYPASS_EMAIL, name: "Dev User", emailVerified: true },
      select: { id: true, email: true, name: true },
    });
    return user;
  }
  const session = await getSession();
  return session?.user ?? null;
}