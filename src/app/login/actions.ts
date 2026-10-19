"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  readSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { AuditAction } from "@/generated/prisma/enums";
import { getClientIp, getUserAgent } from "@/lib/security";
import { loginSchema } from "@/lib/validation/admin";
import { fieldErrors } from "@/lib/validation/common";
import type { LoginState } from "./login-state";

/** Only allow same-site relative paths as a post-login destination. */
function safeRedirect(target: string | undefined, fallback: string): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const env = getEnv();
  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);
  const userAgent = getUserAgent(requestHeaders);

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return {
      errors: fieldErrors(parsed),
      values: { email: String(formData.get("email") ?? "") },
    };
  }

  const { email, password } = parsed.data;

  // Per-IP throttle (protects the login endpoint itself).
  const ipLimit = rateLimit(`login:ip:${ip}`, env.LOGIN_MAX_ATTEMPTS * 4, env.LOGIN_WINDOW_MINUTES * 60);
  if (!ipLimit.allowed) {
    return {
      errors: {},
      message: "Too many sign-in attempts. Please wait a few minutes and try again.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  // Per-account throttle: survives restarts and works across instances.
  const accountLimit = rateLimit(`login:account:${email}`, env.LOGIN_MAX_ATTEMPTS * 2, env.LOGIN_WINDOW_MINUTES * 60);

  if (!user) {
    // Spend roughly the same time as a real verification to avoid user
    // enumeration through response timing.
    await verifyPassword(password, null);
    await recordAudit({
      action: AuditAction.AUTH_LOGIN_FAILED,
      entityType: "User",
      summary: `Failed sign-in for unknown account.`,
      ipAddress: ip,
      userAgent,
      metadata: { email },
    });
    return { errors: {}, message: "Invalid email or password." };
  }

  if (!user.isActive) {
    await recordAudit({
      action: AuditAction.AUTH_LOGIN_FAILED,
      entityType: "User",
      entityId: user.id,
      summary: `Blocked sign-in for deactivated account.`,
      ipAddress: ip,
      userAgent,
    });
    return { errors: {}, message: "Invalid email or password." };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return {
      errors: {},
      message: `This account is temporarily locked. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!passwordOk) {
    const failedAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedAttempts >= env.LOGIN_MAX_ATTEMPTS && accountLimit.allowed !== false;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: failedAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60 * 1000)
          : user.lockedUntil,
      },
    });
    await recordAudit({
      action: AuditAction.AUTH_LOGIN_FAILED,
      entityType: "User",
      entityId: user.id,
      summary: `Failed sign-in for ${user.email}.`,
      actorId: user.id,
      actorRole: user.role.code,
      ipAddress: ip,
      userAgent,
      metadata: { failedAttempts },
    });
    return { errors: {}, message: "Invalid email or password." };
  }

  // Successful sign-in.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const staff = isStaffRole(user.role.code);
  const { token, expiresAt } = await createSession({
    userId: user.id,
    isStaff: staff,
    ipAddress: ip,
    userAgent,
  });
  await setSessionCookie(token, expiresAt);

  await recordAudit({
    action: AuditAction.AUTH_LOGIN,
    entityType: "User",
    entityId: user.id,
    summary: `Signed in as ${user.email}.`,
    actorId: user.id,
    actorRole: user.role.code,
    ipAddress: ip,
    userAgent,
  });

  const fallback = staff ? "/admin" : "/";
  redirect(safeRedirect(parsed.data.next, fallback));
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    await destroySession(token);
  }
  await clearSessionCookie();
  redirect("/");
}

/** Used by the "session expired" screen to clear the stale cookie. */
export async function clearSessionAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
