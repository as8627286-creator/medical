import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing.
 *
 * Uses Node's built-in scrypt (memory-hard KDF) so that no native module and no
 * third-party hashing dependency is required. Parameters are stored inside the
 * hash string so they can be raised later without invalidating old hashes.
 *
 * Format: `scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>`
 */

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
// scrypt needs roughly 128 * N * r bytes; give it headroom.
const MAX_MEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAX_MEM,
  });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    // Still perform a hash to keep the timing of "unknown user" similar to
    // "wrong password".
    await hashPassword(password);
    return false;
  }
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    await hashPassword(password);
    return false;
  }
  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    await hashPassword(password);
    return false;
  }
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAX_MEM,
    });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * Minimum password policy applied to administrator and customer accounts.
 */
export function validatePasswordStrength(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 12) problems.push("must be at least 12 characters long");
  if (!/[a-z]/.test(password)) problems.push("must contain a lowercase letter");
  if (!/[A-Z]/.test(password)) problems.push("must contain an uppercase letter");
  if (!/[0-9]/.test(password)) problems.push("must contain a digit");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("must contain a symbol");
  return problems;
}
