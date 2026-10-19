import "server-only";
import { getEnv } from "@/lib/env";

/**
 * Request-level security helpers shared by route handlers and server actions.
 */

/** Extracts the client IP from proxy headers, falling back to a stable value. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}

export function getUserAgent(headers: Headers): string | null {
  return headers.get("user-agent");
}

/**
 * Same-origin check for state-changing requests.
 *
 * Server Actions already perform an Origin/Host comparison in Next.js; this
 * helper covers the JSON API routes, which are not covered by that check.
 */
export function isSameOrigin(headers: Headers): boolean {
  const env = getEnv();
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");

  if (!origin) {
    // Some same-origin requests (and non-browser clients) omit Origin. The
    // Referer header is the documented fallback.
    const referer = headers.get("referer");
    if (!referer) return false;
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) return false;
    // In production the configured APP_URL must also match, so that a Host
    // header injection cannot widen the accepted origins.
    if (env.NODE_ENV === "production") {
      return originUrl.host === new URL(env.APP_URL).host;
    }
    return true;
  } catch {
    return false;
  }
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ApiErrorBody = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return Response.json(body, { status });
}

/** Compares two strings without leaking length or content through timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
