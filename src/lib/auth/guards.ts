import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { hasPermission, isStaffRole, type Permission } from "@/lib/auth/rbac";

/**
 * Server-side authorization guards.
 *
 * Every protected page, route handler and server action calls one of these.
 * UI visibility is never treated as access control.
 */

export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login";
    redirect(target);
  }
  return user;
}

export async function requireStaff(returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!isStaffRole(user.role.code)) {
    redirect("/");
  }
  return user;
}

export async function requirePermission(
  permission: Permission,
  returnTo?: string,
): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!hasPermission(user.role, permission)) {
    redirect("/admin/forbidden");
  }
  return user;
}

export class AuthorizationError extends Error {
  readonly status = 403 as const;
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Guard for API route handlers and server actions: throws instead of
 * redirecting so the caller can translate it into a 403 response.
 */
export async function authorize(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthorizationError("Authentication required.");
  }
  if (!hasPermission(user.role, permission)) {
    throw new AuthorizationError();
  }
  return user;
}

export async function authorizeStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthorizationError("Authentication required.");
  }
  if (!isStaffRole(user.role.code)) {
    throw new AuthorizationError("Staff access required.");
  }
  return user;
}
