/**
 * Daily maintenance.
 *
 * Run from cron on the server:
 *
 *   0 3 * * * cd /app && node --conditions=react-server --import tsx scripts/maintenance.ts
 *
 * Every task is idempotent, so a repeated run is safe.
 */

import "dotenv/config";
import "server-only";
import { prisma } from "@/lib/db";
import { expireStalePrescriptions } from "@/lib/prescriptions/service";
import { pruneExpiredSessions } from "@/lib/auth/session";
import { pruneRateLimitBuckets } from "@/lib/rate-limit";

async function main() {
  const expired = await expireStalePrescriptions();
  const sessions = await pruneExpiredSessions();
  const buckets = pruneRateLimitBuckets();

  console.log(
    JSON.stringify({
      event: "maintenance.completed",
      expiredPrescriptions: expired,
      removedSessions: sessions,
      removedRateLimitBuckets: buckets,
      timestamp: new Date().toISOString(),
    }),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "maintenance.failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    await prisma.$disconnect();
    process.exit(1);
  });
