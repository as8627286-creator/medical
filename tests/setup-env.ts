import path from "node:path";
import os from "node:os";
import { testDatabaseUrl } from "./helpers/db";

/**
 * Per-test-file environment.
 *
 * The tests run against the dedicated `medical_store_test` database and write
 * uploaded files to a temporary directory, so a test run never touches the
 * development data.
 */
process.env.DATABASE_URL = testDatabaseUrl();
process.env.STORAGE_LOCAL_ROOT = path.join(os.tmpdir(), "medical-store-test-storage");
process.env.SESSION_COOKIE_NAME = "ms_test_session";
