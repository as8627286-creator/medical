import "dotenv/config";
import { prepareTestDatabase } from "./helpers/db";

/**
 * Global setup: creates the test database and applies the migrations once,
 * before any test file runs.
 */
export default async function setup(): Promise<void> {
  await prepareTestDatabase();
}
