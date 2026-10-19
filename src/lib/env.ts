import "server-only";
import { z } from "zod";

/**
 * Central, validated access to environment variables.
 *
 * Rules:
 *  - No secret is ever imported from a client component (`server-only` guard).
 *  - Nothing is read from `process.env` outside this module.
 *  - Validation happens once, lazily, so a missing variable produces one clear
 *    error instead of `undefined` leaking into application logic.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === "boolean" ? value : ["1", "true", "yes", "on"].includes(value.toLowerCase()),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Database -----------------------------------------------------------
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // --- Application --------------------------------------------------------
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().min(1).default("Medical Store"),

  // --- Sessions -----------------------------------------------------------
  SESSION_COOKIE_NAME: z.string().min(1).default("ms_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(4),

  // --- Login protection ---------------------------------------------------
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

  // --- Rate limiting (per IP, in-process) ---------------------------------
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),

  // --- File storage -------------------------------------------------------
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_ROOT: z.string().min(1).default("./storage"),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ENDPOINT: z.string().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_FORCE_PATH_STYLE: booleanish.default(false),

  // --- Uploads ------------------------------------------------------------
  MAX_PRODUCT_IMAGE_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  MAX_PRESCRIPTION_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  PRODUCT_IMAGE_WIDTHS: z.string().default("320,640,1280"),

  // --- Payments -----------------------------------------------------------
  /** Provider code used for online payments. `sandbox` never moves real money. */
  PAYMENT_PROVIDER: z.enum(["sandbox", "razorpay", "stripe"]).default("sandbox"),
  /** Master switch for real money. Must stay false until compliance + merchant approval. */
  PAYMENT_LIVE: booleanish.default(false),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_RAZORPAY_KEY_ID: z.string().optional(),
  PAYMENT_RAZORPAY_KEY_SECRET: z.string().optional(),
  PAYMENT_RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_STRIPE_SECRET_KEY: z.string().optional(),
  PAYMENT_STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_CURRENCY: z.string().min(3).max(3).default("INR"),

  // --- Bootstrap ----------------------------------------------------------
  /** One-time token required by the first-admin bootstrap script. */
  ADMIN_BOOTSTRAP_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration -> ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: force re-read of process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
