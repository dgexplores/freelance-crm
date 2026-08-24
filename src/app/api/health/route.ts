import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
    version: process.env["npm_package_version"] ?? "0.1.0",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const healthy = checks.database;

  return Response.json(checks, {
    status: healthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}