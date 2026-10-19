import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    // The integration tests share one PostgreSQL database, so the files run
    // sequentially instead of in parallel.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/env.ts", "src/lib/db.ts", "src/generated/**"],
    },
  },
  resolve: {
    alias: {
      // `server-only` is a bundler guard that throws when a module is pulled
      // into a client bundle. The tests run in Node, not in a browser, so the
      // guard is replaced by an empty module. The bundler still enforces the
      // real guard in the application build.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
