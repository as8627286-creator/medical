import "server-only";
import { prisma } from "@/lib/db";
import type { StoreSettingsView } from "@/lib/store/types";

export type { StoreSettingsView };

/**
 * Store settings.
 *
 * The settings table holds a single row (id = 1) that is created on demand.
 */

const DEFAULTS: Omit<StoreSettingsView, "updatedAt"> = {
  id: 1,
  pharmacyName: "Medical Store",
  legalName: null,
  licenseNumber: null,
  pharmacistName: null,
  pharmacistRegistrationNumber: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  pincode: null,
  phone: null,
  email: null,
  gstin: null,
  aboutText: null,
  refundPolicyText: null,
  deliveryPolicyText: null,
  privacyPolicyText: null,
  supportEmail: null,
  supportPhone: null,
  businessHours: null,
  minOrderAmountInPaise: 0,
  defaultDeliveryFeeInPaise: 0,
  codEnabled: true,
  codMinOrderAmountInPaise: 0,
  codMaxOrderAmountInPaise: null,
  salesEnabled: false,
  livePaymentsEnabled: false,
  complianceConfirmed: false,
  complianceConfirmedAt: null,
  maintenanceMode: false,
};

export async function getStoreSettings(): Promise<StoreSettingsView> {
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    return { ...DEFAULTS, updatedAt: new Date(0) };
  }
  return settings as unknown as StoreSettingsView;
}

/** Returns the settings row, creating the default row if it is missing. */
export async function ensureStoreSettings(): Promise<StoreSettingsView> {
  const existing = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing as unknown as StoreSettingsView;
  return prisma.storeSettings.create({
    data: { id: 1, pharmacyName: "Medical Store" },
  }) as unknown as Promise<StoreSettingsView>;
}
