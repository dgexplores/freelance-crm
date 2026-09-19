import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Reuse across module reloads in every env. On Vercel serverless a warm
// function reuses globals; a fresh client per invocation exhausts Postgres
// connections until queries stall (board Suspense hung -> React #412).
globalForPrisma.prisma = prisma;