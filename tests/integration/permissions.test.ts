import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Authorization is enforced on the server. These tests exercise the guard
 * that every protected page, route handler and server action calls.
 *
 * The session lookup is replaced with a stub so that the guard can be tested
 * without a browser; the permission logic itself is the production code.
 */

const sessionState: { user: unknown } = { user: null };

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    getSessionUser: async () => sessionState.user,
  };
});

const { authorize, authorizeStaff, AuthorizationError } = await import("@/lib/auth/guards");
const { PERMISSIONS, hasPermission } = await import("@/lib/auth/rbac");
const { ADMIN_PERMISSIONS, CUSTOMER_PERMISSIONS, PHARMACIST_PERMISSIONS } = await import(
  "@/lib/auth/rbac"
);

const customer = {
  id: "customer-1",
  email: "customer@test.local",
  fullName: "Customer",
  phone: null,
  isActive: true,
  role: { code: "CUSTOMER", name: "Customer", permissions: CUSTOMER_PERMISSIONS },
};

const pharmacist = {
  id: "pharmacist-1",
  email: "pharmacist@test.local",
  fullName: "Pharmacist",
  phone: null,
  isActive: true,
  role: { code: "PHARMACIST", name: "Pharmacist", permissions: PHARMACIST_PERMISSIONS },
};

const admin = {
  id: "admin-1",
  email: "admin@test.local",
  fullName: "Admin",
  phone: null,
  isActive: true,
  role: { code: "ADMIN", name: "Administrator", permissions: ADMIN_PERMISSIONS },
};

describe("server-side authorization", () => {
  beforeAll(() => {
    sessionState.user = null;
  });

  it("refuses an unauthenticated request", async () => {
    sessionState.user = null;
    await expect(authorize(PERMISSIONS.PRODUCT_READ)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(authorizeStaff()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("refuses a customer access to an administrative operation", async () => {
    sessionState.user = customer;
    await expect(authorize(PERMISSIONS.PRODUCT_WRITE)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(authorize(PERMISSIONS.ORDER_READ)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(authorize(PERMISSIONS.PRESCRIPTION_REVIEW)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(authorizeStaff()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("lets a pharmacist review prescriptions but not change legal restrictions", async () => {
    sessionState.user = pharmacist;

    await expect(authorize(PERMISSIONS.PRESCRIPTION_REVIEW)).resolves.toMatchObject({
      id: "pharmacist-1",
    });
    await expect(authorize(PERMISSIONS.PRODUCT_WRITE)).resolves.toBeTruthy();
    await expect(
      authorize(PERMISSIONS.PRODUCT_LEGAL_RESTRICTION_WRITE),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(authorize(PERMISSIONS.SETTINGS_WRITE)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(authorize(PERMISSIONS.USER_MANAGE)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("lets an administrator do everything", async () => {
    sessionState.user = admin;
    await expect(authorize(PERMISSIONS.PRODUCT_LEGAL_RESTRICTION_WRITE)).resolves.toBeTruthy();
    await expect(authorize(PERMISSIONS.SETTINGS_WRITE)).resolves.toBeTruthy();
    await expect(authorize(PERMISSIONS.AUDIT_READ)).resolves.toBeTruthy();
  });
});

describe("permission helpers", () => {
  it("answers permission questions from the role", () => {
    expect(hasPermission(admin.role, PERMISSIONS.AUDIT_READ)).toBe(true);
    expect(hasPermission(customer.role, PERMISSIONS.AUDIT_READ)).toBe(false);
    expect(hasPermission(pharmacist.role, PERMISSIONS.PRESCRIPTION_REVIEW)).toBe(true);
    expect(hasPermission(null, PERMISSIONS.PRODUCT_READ)).toBe(false);
  });
});
