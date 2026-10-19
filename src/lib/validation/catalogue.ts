import { z } from "zod";
import {
  DosageForm,
  LegalRestriction,
  SaleEligibility,
} from "@/generated/prisma/enums";
import { nameSchema, optionalText, requiredText } from "./common";
import { requiredNumber } from "./form";

/**
 * Catalogue input schemas.
 *
 * Note which fields are *not* editable here: `legalRestriction` is not part of
 * the product editor payload at all. Legal restrictions are changed through a
 * dedicated, separately authorised action so that they cannot be cleared by
 * ordinary product editing.
 */

export const dosageFormValues = Object.values(DosageForm) as [DosageForm, ...DosageForm[]];

export const productCreateSchema = z.object({
  name: requiredText(160, "Enter the product name"),
  brand: optionalText(120),
  manufacturer: requiredText(160, "Enter the manufacturer name"),
  strength: optionalText(60),
  dosageForm: z.enum(dosageFormValues, { message: "Select a dosage form" }),
  packSize: requiredText(40, "Enter the pack size"),
  packUnit: optionalText(40),
  sku: requiredText(64, "Enter a SKU")
    .regex(/^[A-Za-z0-9._-]+$/, "SKU may contain letters, numbers, dot, dash and underscore"),
  description: optionalText(4000),
  warnings: optionalText(2000),
  usageInformation: optionalText(4000),
  storageInstructions: optionalText(1000),
  additionalInfo: optionalText(2000),
  mrpInPaise: requiredNumber.refine((v) => v >= 0, "Enter a valid MRP").nullable().optional(),
  sellingPriceInPaise: requiredNumber.refine((v) => v > 0, "Enter a valid selling price"),
  taxPercent: requiredNumber.refine((v) => v >= 0 && v <= 100, "Tax must be between 0 and 100"),
  stockQuantity: requiredNumber.refine((v) => Number.isInteger(v) && v >= 0, "Enter a valid stock quantity"),
  lowStockThreshold: requiredNumber.refine(
    (v) => Number.isInteger(v) && v >= 0,
    "Enter a valid low stock threshold",
  ),
  categoryId: z.string().uuid("Select a category"),
  prescriptionRequired: z.coerce.boolean(),
  saleEligibility: z.enum(
    Object.values(SaleEligibility) as [SaleEligibility, ...SaleEligibility[]],
    { message: "Select a sale eligibility" },
  ),
  isActive: z.coerce.boolean(),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.string().uuid("Invalid product"),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const categorySchema = z.object({
  name: requiredText(80, "Enter a category name"),
  slug: z
    .string()
    .trim()
    .min(2, "Enter a slug")
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only"),
  description: optionalText(500),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  isActive: z.coerce.boolean(),
});

export const stockAdjustmentSchema = z.object({
  productId: z.string().uuid("Invalid product"),
  delta: requiredNumber.refine(
    (value) => Number.isInteger(value) && value !== 0,
    "Enter a non-zero whole number",
  ),
  reason: z.enum(
    [
      "PURCHASE",
      "SALE",
      "RETURN",
      "DAMAGE",
      "EXPIRY",
      "CORRECTION",
      "RESERVATION_RELEASE",
      "RECALL",
    ] as const,
    { message: "Select a reason" },
  ),
  note: optionalText(500),
});

export const priceChangeSchema = z.object({
  productId: z.string().uuid("Invalid product"),
  sellingPriceInPaise: requiredNumber.refine((v) => v > 0, "Enter a valid selling price"),
  mrpInPaise: requiredNumber.refine((v) => v >= 0, "Enter a valid MRP").nullable().optional(),
  reason: optionalText(300),
});

/**
 * Legal restriction change. Deliberately a separate schema and a separate
 * permission from the ordinary product editor.
 */
export const legalRestrictionSchema = z.object({
  productId: z.string().uuid("Invalid product"),
  legalRestriction: z.enum(
    Object.values(LegalRestriction) as [LegalRestriction, ...LegalRestriction[]],
    { message: "Select a restriction" },
  ),
  note: requiredText(500, "Record why the restriction is changing"),
});

export const productSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  prescriptionRequired: z.coerce.boolean().optional(),
  inStockOnly: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const productSortSchema = z.enum([
  "name_asc",
  "name_desc",
  "price_asc",
  "price_desc",
  "newest",
  "stock_asc",
]);

export { nameSchema };
