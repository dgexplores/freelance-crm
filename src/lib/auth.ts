import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

const googleClientId = process.env["GOOGLE_CLIENT_ID"] ?? "";
const googleClientSecret = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
const betterAuthUrl = process.env["BETTER_AUTH_URL"];
const betterAuthSecret = process.env["BETTER_AUTH_SECRET"];

if (!betterAuthSecret) {
  throw new Error(
    "Missing BETTER_AUTH_SECRET. Generate with: openssl rand -base64 32",
  );
}

if (!googleClientId || !googleClientSecret) {
  const msg =
    "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing – Google OAuth will fail.";
  if (process.env["NODE_ENV"] === "production") throw new Error(msg);
  else console.warn(`[auth] ${msg}`);
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: betterAuthUrl,
  secret: betterAuthSecret,
  trustedOrigins: betterAuthUrl ? [betterAuthUrl] : [],
  socialProviders: {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      accessType: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    },
  },
  plugins: [nextCookies()],
});