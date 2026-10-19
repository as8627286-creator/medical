import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * The suite runs against a running development server. Start it first:
 *
 *   npm run db:start && npm run db:migrate && npm run db:seed
 *   npm run dev
 *   npm run test:e2e
 *
 * The browsers have to be installed once: `npx playwright install --with-deps`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
