import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

/**
 * Single Prisma client for the process.
 *
 * The client is created lazily so that importing this module never requires a
 * configured database (important during `next build`, where pages may be
 * imported without a reachable database).
 *
 * Next.js dev mode reloads modules on every edit; without a global cache we
 * would leak a connection pool per reload.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const env = getEnv();
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: 10,
  });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function resolveClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazily-initialised Prisma client. Property access on this proxy creates the
 * real client on first use and then forwards to it.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = resolveClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type { PrismaClient };
