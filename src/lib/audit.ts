import "server-only";
import { prisma } from "@/lib/db";
import { AuditAction } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

/**
 * Audit trail.
 *
 * The audit writer never stores secrets. Callers pass a pre-redacted summary
 * and a metadata object they have already checked; passwords, session tokens,
 * payment secrets and prescription contents must never appear here.
 */

export interface AuditInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  actorId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const REDACTED_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "passwordhash",
  "token",
  "sessiontoken",
  "secret",
  "apikey",
  "authorization",
  "signature",
  "cookie",
  "card",
  "cardnumber",
  "cvv",
]);

/**
 * A mutable JSON object.
 *
 * `Prisma.InputJsonObject` declares a read-only index signature, so it cannot
 * be filled in place. This alias is used while building the value and the
 * result is handed to Prisma as an `InputJsonObject`.
 */
type MutableJsonObject = Record<string, Prisma.InputJsonValue | null>;

/**
 * Converts an arbitrary value into something Prisma can store in a JSON column.
 *
 * Only JSON primitives survive. Anything else (Date, Buffer, class instances,
 * functions, cycles) is dropped rather than stringified, so the audit row can
 * never fail to write because of an unexpected value, and a secret can never
 * leak through a custom `toJSON`.
 *
 * Redaction by key name is applied at every depth, not only at the top level:
 * a nested `password` or `token` is exactly as sensitive as a top-level one.
 */
function toJsonValue(value: unknown, depth = 0): Prisma.InputJsonValue | null {
  if (depth > 4) return null;
  if (value === null) return null;
  switch (typeof value) {
    case "string":
      return value.length > 500 ? `${value.slice(0, 500)}...` : value;
    case "number":
      return Number.isFinite(value) ? value : null;
    case "boolean":
      return value;
    case "object": {
      if (Array.isArray(value)) {
        return value
          .map((entry) => toJsonValue(entry, depth + 1))
          .filter((entry): entry is Prisma.InputJsonValue => entry !== null);
      }
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
        return null;
      }
      const output: MutableJsonObject = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (REDACTED_KEYS.has(key.toLowerCase())) {
          output[key] = "[redacted]";
          continue;
        }
        const converted = toJsonValue(entry, depth + 1);
        if (converted !== null) output[key] = converted;
      }
      return output;
    }
    default:
      return null;
  }
}

/** Removes obviously sensitive keys from audit metadata, at any depth. */
export function redactMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Prisma.InputJsonObject | null {
  if (!metadata) return null;
  const converted = toJsonValue(metadata);
  return converted === null ? null : (converted as Prisma.InputJsonObject);
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary.slice(0, 500),
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        metadata: redactMetadata(input.metadata) ?? undefined,
        ipAddress: input.ipAddress?.slice(0, 64) ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    // Audit failures must not break the business operation, but they must be
    // visible in the logs.
    console.error(
      JSON.stringify({
        level: "error",
        event: "audit.write_failed",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
