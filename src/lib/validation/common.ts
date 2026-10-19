import { z } from "zod";

/**
 * Shared input primitives.
 *
 * These are the single definition of what the application accepts from a
 * browser. Every form, query string and JSON body is parsed with them before
 * it reaches the domain layer.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

/** Indian mobile number: 10 digits starting with 6-9, optional +91 prefix. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .transform((value) => (value.startsWith("+91") ? value.slice(3) : value))
  .refine((value) => /^[6-9]\d{9}$/.test(value), "Enter a valid 10-digit mobile number");

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter at least 2 characters")
  .max(120, "This value is too long");

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();

export const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `Must be ${max} characters or fewer`);

export const idSchema = z.string().uuid("Invalid identifier");

/** Password confirmation field. */
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long")
  .max(200, "Password is too long");

/** Rupee amount entered in a form. */
export const rupeeAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === "number" ? value : Number(value.trim())))
  .refine(
    (value) => Number.isFinite(value) && value >= 0,
    "Enter a valid amount",
  )
  .refine((value) => Number.isInteger(Math.round(value * 100)), "Enter a valid amount")
  .transform((value) => Math.round(value * 100));

export const positiveIntSchema = z.coerce
  .number()
  .int("Enter a whole number")
  .min(0, "Cannot be negative")
  .max(1_000_000, "Value is too large");

export const quantitySchema = z.coerce
  .number()
  .int("Enter a whole number")
  .min(1, "Quantity must be at least 1")
  .max(999, "Quantity is too large");

/**
 * Validates that a `FormData` entry parsed as an object matches a schema and
 * returns a flat list of human-readable field errors.
 */
export function fieldErrors(
  result: { success: boolean; error?: { flatten(): { fieldErrors: Record<string, string[] | undefined> } } },
): Record<string, string> {
  if (result.success) return {};
  const flat = result.error!.flatten().fieldErrors;
  const output: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages && messages.length > 0) output[key] = messages[0]!;
  }
  return output;
}
