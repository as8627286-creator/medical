import "server-only";

/**
 * In-process fixed-window rate limiter.
 *
 * Scope: a single Node.js process. For a multi-instance deployment this must be
 * replaced with a shared store (Redis) or an upstream limiter (nginx
 * `limit_req`). Documented in docs/SECURITY.md.
 *
 * The login limiter additionally has a database-backed per-account lock, so
 * account-level brute force protection survives a restart and works across
 * instances.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - 1,
    retryAfterSeconds: 0,
  };
}

/** Removes expired buckets. Called periodically to bound memory usage. */
export function pruneRateLimitBuckets(): number {
  const now = Date.now();
  let removed = 0;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
