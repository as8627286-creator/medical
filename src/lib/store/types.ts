/**
 * The shape of the store settings.
 *
 * This module has no server-only imports on purpose: the administration form
 * is a client component and needs the type. The values themselves are read on
 * the server in `lib/store/settings.ts`.
 */

export interface StoreSettingsView {
  id: number;
  pharmacyName: string;
  legalName: string | null;
  licenseNumber: string | null;
  pharmacistName: string | null;
  pharmacistRegistrationNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  aboutText: string | null;
  refundPolicyText: string | null;
  deliveryPolicyText: string | null;
  privacyPolicyText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  businessHours: string | null;
  minOrderAmountInPaise: number;
  defaultDeliveryFeeInPaise: number;
  codEnabled: boolean;
  codMinOrderAmountInPaise: number;
  codMaxOrderAmountInPaise: number | null;
  salesEnabled: boolean;
  livePaymentsEnabled: boolean;
  complianceConfirmed: boolean;
  complianceConfirmedAt: Date | null;
  maintenanceMode: boolean;
  updatedAt: Date;
}
