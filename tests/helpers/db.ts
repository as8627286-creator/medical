import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Test database helpers.
 *
 * The integration tests run against a real PostgreSQL database (a separate
 * database on the same server, `medical_store_test`) so that transactions,
 * unique constraints and row-level locking behave exactly as they do in
 * production.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const TEST_DATABASE_NAME = process.env.TEST_DATABASE_NAME ?? "medical_store_test";

function baseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Run the tests through `npm test`.");
  }
  return url;
}

export function testDatabaseUrl(): string {
  const url = new URL(baseUrl());
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}

async function createDatabaseIfMissing(): Promise<void> {
  const url = new URL(baseUrl());
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const result = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      TEST_DATABASE_NAME,
    ]);
    if (result.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
    }
  } finally {
    await admin.end();
  }
}

/** Creates the test database and applies every migration. */
export async function prepareTestDatabase(): Promise<void> {
  await createDatabaseIfMissing();

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}

export function createTestClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: testDatabaseUrl(), max: 5 });
  return new PrismaClient({ adapter });
}

/**
 * Empties every table. Used between test files so that each file starts from
 * a known state.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditEvent",
      "PaymentWebhookEvent",
      "Payment",
      "PrescriptionReview",
      "PrescriptionRequirement",
      "PrescriptionDocument",
      "DeliveryRecord",
      "DeliveryZonePincode",
      "DeliveryZone",
      "OrderItem",
      "Order",
      "CartItem",
      "Cart",
      "PriceHistory",
      "InventoryAdjustment",
      "ProductImage",
      "Product",
      "ProductCategory",
      "Address",
      "CustomerProfile",
      "Session",
      "User",
      "Role",
      "StoreSetting",
      "StoreSettings"
    RESTART IDENTITY CASCADE
  `);
}
