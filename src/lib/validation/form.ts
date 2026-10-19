import { z } from "zod";

/**
 * Helpers for turning a `FormData` payload into a plain object that a Zod
 * schema can parse.
 *
 * Everything the browser sends is untrusted: values are coerced to strings,
 * missing fields become empty strings, and checkboxes become booleans. The
 * schema then decides what is acceptable.
 */

export function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value === "string") return value;
  if (value instanceof File) return value.name;
  return "";
}

export function formValues(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string");
}

export function formCheckbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

/** Reads a required numeric field; empty or invalid input becomes NaN. */
export function formNumber(formData: FormData, key: string): number {
  const raw = formValue(formData, key).trim();
  if (raw === "") return Number.NaN;
  return Number(raw);
}

/** Reads a numeric field, falling back to a default when empty. */
export function formNumberOr(formData: FormData, key: string, fallback: number): number {
  const raw = formValue(formData, key).trim();
  if (raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function formFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

/**
 * A number field that must not be blank. Rejects "" (which `z.coerce.number`
 * would silently turn into 0).
 */
export const requiredNumber = z
  .preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") return undefined;
    return value;
  }, z.coerce.number("Enter a valid number"))
  .refine((value) => Number.isFinite(value), "Enter a valid number");

export const optionalNumber = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string" && value.trim() === "") return undefined;
    return value;
  },
  z.coerce.number("Enter a valid number").optional(),
);
