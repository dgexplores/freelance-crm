import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * Returns the session user or null if not authenticated.
 * Use with middleware for protected routes.
 */
export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}