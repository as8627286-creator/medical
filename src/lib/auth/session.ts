import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { PermissionSet } from "@/lib/auth/rbac";

/**
 * Server-managed sessions.
 *
 * Design:
 *  - The browser holds an opaque, high-entropy token in an HttpOnly cookie.
 *  - The database stores only the SHA-256 hash of that token, so a database
 *    leak does not yield usable session credentials.
 *  - Sessions are revocable (logout, role change, "log out everywhere").
 *  - The cookie is SameSite=Lax + Secure in production, which is the primary
 *    CSRF defence for state-changing requests.
 */

const TOKEN_BYTES = 32;

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: PermissionSet & { code: string; name: string };
  isActive: boolean;
}

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(params: {
  userId: string;
  isStaff: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const env = getEnv();
  const ttlHours = params.isStaff ? env.ADMIN_SESSION_TTL_HOURS : env.SESSION_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const token = generateSessionToken();

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId: params.userId,
      expiresAt,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent?.slice(0, 255) ?? null,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const env = getEnv();
  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const env = getEnv();
  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Reads the raw session token from the request cookie. */
export async function readSessionToken(): Promise<string | null> {
  const env = getEnv();
  const cookieStore = await cookies();
  return cookieStore.get(env.SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Resolves the current session user, or null when there is no valid session.
 * Expired sessions and sessions created before a global logout are rejected.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: { role: true },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (!session.user.isActive) return null;
  if (session.user.sessionsValidFrom.getTime() > session.createdAt.getTime()) {
    // The user's sessions were invalidated after this session was created.
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    phone: session.user.phone,
    isActive: session.user.isActive,
    role: {
      code: session.user.role.code,
      name: session.user.role.name,
      permissions: session.user.role.permissions,
    },
  };
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session
    .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
    .catch(() => undefined);
}

/** Invalidates every session of a user (password change, role change, lock). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { sessionsValidFrom: new Date() },
  });
}

/** Removes expired sessions. Called opportunistically and by the cron script. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
