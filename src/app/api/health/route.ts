import { prisma } from "@/lib/db";

/**
 * Health check.
 *
 * Reports whether the application can reach the database. It is used by the
 * container health check and by the reverse proxy. It never exposes
 * configuration or internal error details.
 */

export async function GET() {
  const startedAt = Date.now();
  let database = "down";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  const healthy = database === "up";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      uptimeSeconds: Math.round(process.uptime()),
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
