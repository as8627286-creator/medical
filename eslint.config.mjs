import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noServerOnlyImport from "./eslint-rules/no-server-only-import.mjs";

/**
 * Server-only modules. A client component (a file with the "use client"
 * directive) must not import these: they pull the database client and the
 * storage driver into the browser bundle.
 */
const SERVER_ONLY_MODULES = [
  "@/lib/db",
  "@/lib/env",
  "@/lib/audit",
  "@/lib/storage",
  "@/lib/auth/session",
  "@/lib/auth/guards",
  "@/lib/auth/rbac",
  "@/lib/media/uploads",
  "@/lib/catalogue/images",
  "@/lib/payments/service",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Cache Components is deliberately disabled in next.config.ts: the
    // storefront shows live prices, live stock and live session state, and
    // the classic dynamic rendering model makes those freshness rules
    // explicit. See docs/ARCHITECTURE.md, section "Rendering model".
    //
    // With Cache Components enabled, `export const dynamic` is rejected
    // outright by Next.js. While it is disabled, the explicit
    // `export const dynamic = "force-dynamic"` on every data-bearing route is
    // what guarantees that a page is never served from a stale prerender.
    rules: {},
  },
  {
    plugins: {
      local: { rules: { "no-server-only-import": noServerOnlyImport } },
    },
    rules: {
      "local/no-server-only-import": [
        "error",
        { modules: SERVER_ONLY_MODULES },
      ],
    },
  },
]);

export default eslintConfig;
