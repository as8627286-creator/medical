import { z } from "zod";
import { emailSchema, optionalText, phoneSchema, pincodeSchema } from "./common";
import { optionalNumber, requiredNumber } from "./form";

/**
 * Administrative input schemas: store settings, delivery zones, users.
 */

export const storeSettingsSchema = z.object({
  pharmacyName: z.string().trim().min(2, "Enter the pharmacy name").max(160),
  legalName: optionalText(160),
  licenseNumber: optionalText(80),
  pharmacistName: optionalText(120),
  pharmacistRegistrationNumber: optionalText(80),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(80),
  state: optionalText(80),
  pincode: pincodeSchema.nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  email: emailSchema.nullable().optional(),
  gstin: optionalText(32),
  aboutText: optionalText(4000),
  refundPolicyText: optionalText(4000),
  deliveryPolicyText: optionalText(4000),
  privacyPolicyText: optionalText(4000),
  supportEmail: emailSchema.nullable().optional(),
  supportPhone: phoneSchema.nullable().optional(),
  businessHours: optionalText(200),
  minOrderAmountInPaise: requiredNumber.refine((v) => v >= 0, "Enter a valid amount"),
  defaultDeliveryFeeInPaise: requiredNumber.refine((v) => v >= 0, "Enter a valid amount"),
  codEnabled: z.coerce.boolean(),
  codMinOrderAmountInPaise: requiredNumber.refine((v) => v >= 0, "Enter a valid amount"),
  codMaxOrderAmountInPaise: optionalNumber.refine(
    (v) => v === undefined || v >= 0,
    "Enter a valid amount",
  ),
  salesEnabled: z.coerce.boolean(),
  livePaymentsEnabled: z.coerce.boolean(),
  complianceConfirmed: z.coerce.boolean(),
  maintenanceMode: z.coerce.boolean(),
});

export const deliveryZoneSchema = z.object({
  name: z.string().trim().min(2, "Enter a zone name").max(120),
  city: optionalText(80),
  description: optionalText(500),
  deliveryFeeInPaise: requiredNumber.refine((v) => v >= 0, "Enter a valid amount"),
  minOrderAmountInPaise: requiredNumber.refine((v) => v >= 0, "Enter a valid amount"),
  estimatedDaysMin: optionalNumber.refine(
    (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 60),
    "Enter 0-60 days",
  ),
  estimatedDaysMax: optionalNumber.refine(
    (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 60),
    "Enter 0-60 days",
  ),
  orderCutoffTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
    .nullable()
    .optional(),
  isActive: z.coerce.boolean(),
  pincodes: z
    .array(pincodeSchema)
    .min(1, "Add at least one PIN code")
    .max(500, "Too many PIN codes in one request"),
});

export const zonePincodeSchema = z.object({
  zoneId: z.string().uuid("Invalid zone"),
  pincode: pincodeSchema,
  city: optionalText(80),
});

export const userCreateSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(2, "Enter a name").max(120),
  phone: phoneSchema.optional(),
  password: z.string().min(12, "Password must be at least 12 characters long").max(200),
  roleCode: z.enum(["ADMIN", "PHARMACIST", "CUSTOMER"]),
});

export const userUpdateSchema = z.object({
  userId: z.string().uuid("Invalid user"),
  fullName: z.string().trim().min(2, "Enter a name").max(120).optional(),
  phone: phoneSchema.nullable().optional(),
  isActive: z.coerce.boolean().optional(),
  roleCode: z.enum(["ADMIN", "PHARMACIST", "CUSTOMER"]).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: z.string().min(12, "Password must be at least 12 characters long").max(200),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().max(200).optional(),
});
