import "server-only";

/**
 * Role-based access control.
 *
 * Permissions are plain strings of the form `<resource>:<action>`. They are
 * stored on the Role row so that new roles can be created without a code
 * change, while the constants below keep call sites typo-proof.
 */

export const PERMISSIONS = {
  PRODUCT_READ: "product:read",
  PRODUCT_WRITE: "product:write",
  PRODUCT_PRICE_WRITE: "product:price",
  PRODUCT_STOCK_WRITE: "product:stock",
  PRODUCT_IMAGE_WRITE: "product:image",
  /** Changing a legal restriction is separated from ordinary product editing. */
  PRODUCT_LEGAL_RESTRICTION_WRITE: "product:legal_restriction",
  ORDER_READ: "order:read",
  ORDER_WRITE: "order:write",
  ORDER_CANCEL: "order:cancel",
  PRESCRIPTION_REVIEW: "prescription:review",
  PRESCRIPTION_READ: "prescription:read",
  DELIVERY_WRITE: "delivery:write",
  DELIVERY_ZONE_WRITE: "delivery_zone:write",
  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",
  USER_MANAGE: "user:manage",
  AUDIT_READ: "audit:read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const PHARMACIST_PERMISSIONS: Permission[] = [
  PERMISSIONS.PRODUCT_READ,
  PERMISSIONS.PRODUCT_WRITE,
  PERMISSIONS.PRODUCT_PRICE_WRITE,
  PERMISSIONS.PRODUCT_STOCK_WRITE,
  PERMISSIONS.PRODUCT_IMAGE_WRITE,
  PERMISSIONS.ORDER_READ,
  PERMISSIONS.ORDER_WRITE,
  PERMISSIONS.ORDER_CANCEL,
  PERMISSIONS.PRESCRIPTION_REVIEW,
  PERMISSIONS.PRESCRIPTION_READ,
  PERMISSIONS.DELIVERY_WRITE,
  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.AUDIT_READ,
];

export const ADMIN_PERMISSIONS: Permission[] = [
  ...ALL_PERMISSIONS,
];

export const CUSTOMER_PERMISSIONS: Permission[] = [];

/**
 * Staff roles are allowed to sign in to the admin area. A pharmacist is
 * authorised to review prescriptions; an administrator manages the business.
 */
export const STAFF_ROLE_CODES = ["ADMIN", "PHARMACIST"] as const;

export type StaffRoleCode = (typeof STAFF_ROLE_CODES)[number];

export function isStaffRole(code: string): code is StaffRoleCode {
  return (STAFF_ROLE_CODES as readonly string[]).includes(code);
}

export type PermissionSet = { code: string; permissions: string[] };

export function hasPermission(
  role: PermissionSet | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return role.permissions.includes(permission);
}

export function hasAnyPermission(
  role: PermissionSet | null | undefined,
  permissions: Permission[],
): boolean {
  if (!role) return false;
  return permissions.some((permission) => role.permissions.includes(permission));
}
