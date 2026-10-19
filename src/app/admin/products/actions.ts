"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { AuditAction, InventoryAdjustmentReason, LegalRestriction } from "@/generated/prisma/enums";
import {
  createProduct,
  updateProduct,
  setProductActive,
  changePrice,
  adjustStock,
  ProductWriteError,
} from "@/lib/catalogue/write";
import {
  addProductImage,
  removeProductImage,
  setPrimaryImage,
  ImageWriteError,
} from "@/lib/catalogue/images";
import {
  legalRestrictionSchema,
  priceChangeSchema,
  productCreateSchema,
  productUpdateSchema,
  stockAdjustmentSchema,
} from "@/lib/validation/catalogue";
import { fieldErrors } from "@/lib/validation/common";
import { formCheckbox, formFile, formNumber, formValue } from "@/lib/validation/form";
import { getClientIp, getUserAgent } from "@/lib/security";

export type AdminActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

function toFieldErrors(error: unknown): Record<string, string> {
  if (error && typeof error === "object" && "flatten" in error) {
    return fieldErrors(error as never);
  }
  return {};
}

async function requestContext() {
  const requestHeaders = await headers();
  return {
    ipAddress: getClientIp(requestHeaders),
    userAgent: getUserAgent(requestHeaders),
  };
}

export async function createProductAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await authorize(PERMISSIONS.PRODUCT_WRITE);

  const raw = {
    name: formValue(formData, "name"),
    brand: formValue(formData, "brand"),
    manufacturer: formValue(formData, "manufacturer"),
    strength: formValue(formData, "strength"),
    dosageForm: formValue(formData, "dosageForm"),
    packSize: formValue(formData, "packSize"),
    packUnit: formValue(formData, "packUnit"),
    sku: formValue(formData, "sku"),
    description: formValue(formData, "description"),
    warnings: formValue(formData, "warnings"),
    usageInformation: formValue(formData, "usageInformation"),
    storageInstructions: formValue(formData, "storageInstructions"),
    additionalInfo: formValue(formData, "additionalInfo"),
    mrpInPaise: formValue(formData, "mrp") === "" ? null : Math.round(formNumber(formData, "mrp") * 100),
    sellingPriceInPaise: Math.round(formNumber(formData, "sellingPrice") * 100),
    taxPercent: formNumber(formData, "taxPercent"),
    stockQuantity: formNumber(formData, "stockQuantity"),
    lowStockThreshold: formNumber(formData, "lowStockThreshold"),
    categoryId: formValue(formData, "categoryId"),
    prescriptionRequired: formCheckbox(formData, "prescriptionRequired"),
    saleEligibility: formValue(formData, "saleEligibility"),
    isActive: formCheckbox(formData, "isActive"),
  };

  const parsed = productCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: toFieldErrors(parsed.error) };
  }

  try {
    const product = await createProduct(parsed.data, { id: actor.id, role: actor.role.code });
    const context = await requestContext();
    await recordAudit({
      action: AuditAction.PRODUCT_CREATED,
      entityType: "Product",
      entityId: product.id,
      summary: `Created product ${product.name} (${product.sku}).`,
      actorId: actor.id,
      actorRole: actor.role.code,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { sku: product.sku },
    });
    revalidatePath("/admin/products");
    revalidatePath("/products");
    redirect(`/admin/products/${product.id}?created=1`);
  } catch (error) {
    if (error instanceof ProductWriteError) {
      return { errors: { sku: error.message } };
    }
    throw error;
  }
}

export async function updateProductAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await authorize(PERMISSIONS.PRODUCT_WRITE);
  const productId = formValue(formData, "id");

  const raw = {
    id: productId,
    name: formValue(formData, "name"),
    brand: formValue(formData, "brand"),
    manufacturer: formValue(formData, "manufacturer"),
    strength: formValue(formData, "strength"),
    dosageForm: formValue(formData, "dosageForm"),
    packSize: formValue(formData, "packSize"),
    packUnit: formValue(formData, "packUnit"),
    sku: formValue(formData, "sku"),
    description: formValue(formData, "description"),
    warnings: formValue(formData, "warnings"),
    usageInformation: formValue(formData, "usageInformation"),
    storageInstructions: formValue(formData, "storageInstructions"),
    additionalInfo: formValue(formData, "additionalInfo"),
    mrpInPaise: formValue(formData, "mrp") === "" ? null : Math.round(formNumber(formData, "mrp") * 100),
    sellingPriceInPaise: Math.round(formNumber(formData, "sellingPrice") * 100),
    taxPercent: formNumber(formData, "taxPercent"),
    lowStockThreshold: formNumber(formData, "lowStockThreshold"),
    categoryId: formValue(formData, "categoryId"),
    prescriptionRequired: formCheckbox(formData, "prescriptionRequired"),
    saleEligibility: formValue(formData, "saleEligibility"),
    isActive: formCheckbox(formData, "isActive"),
  };

  const parsed = productUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: toFieldErrors(parsed.error) };
  }

  try {
    await updateProduct(parsed.data, { id: actor.id, role: actor.role.code });
    const context = await requestContext();
    await recordAudit({
      action: AuditAction.PRODUCT_UPDATED,
      entityType: "Product",
      entityId: productId,
      summary: `Updated product ${parsed.data.sku ?? productId}.`,
      actorId: actor.id,
      actorRole: actor.role.code,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { ok: true, message: "Product updated." };
  } catch (error) {
    if (error instanceof ProductWriteError) {
      return { errors: { sku: error.message } };
    }
    throw error;
  }
}

export async function setProductActiveAction(formData: FormData): Promise<void> {
  const actor = await authorize(PERMISSIONS.PRODUCT_WRITE);
  const productId = formValue(formData, "id");
  const isActive = formCheckbox(formData, "isActive");

  await setProductActive(productId, isActive, { id: actor.id, role: actor.role.code });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function uploadProductImageAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await authorize(PERMISSIONS.PRODUCT_IMAGE_WRITE);
  const productId = formValue(formData, "productId");
  const file = formFile(formData, "photo");

  if (!file) {
    return { errors: { photo: "Choose an image to upload." } };
  }

  try {
    await addProductImage({
      productId,
      file,
      altText: formValue(formData, "altText") || null,
      actor: { id: actor.id, role: actor.role.code },
    });
  } catch (error) {
    if (error instanceof ImageWriteError) {
      return { errors: { photo: error.message } };
    }
    throw error;
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/products");
  return { ok: true, message: "Photo uploaded." };
}

export async function removeProductImageAction(formData: FormData): Promise<void> {
  const actor = await authorize(PERMISSIONS.PRODUCT_IMAGE_WRITE);
  const productId = formValue(formData, "productId");
  const imageId = formValue(formData, "imageId");

  await removeProductImage({ imageId, actor: { id: actor.id, role: actor.role.code } });
  revalidatePath(`/admin/products/${productId}`);
}

export async function setPrimaryImageAction(formData: FormData): Promise<void> {
  const actor = await authorize(PERMISSIONS.PRODUCT_IMAGE_WRITE);
  const productId = formValue(formData, "productId");
  const imageId = formValue(formData, "imageId");

  await setPrimaryImage({ productId, imageId, actor: { id: actor.id, role: actor.role.code } });
  revalidatePath(`/admin/products/${productId}`);
}

export async function adjustStockAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await authorize(PERMISSIONS.PRODUCT_STOCK_WRITE);

  const parsed = stockAdjustmentSchema.safeParse({
    productId: formValue(formData, "productId"),
    delta: formNumber(formData, "delta"),
    reason: formValue(formData, "reason"),
    note: formValue(formData, "note"),
  });

  if (!parsed.success) {
    return { errors: toFieldErrors(parsed.error) };
  }

  try {
    await adjustStock(
      {
        productId: parsed.data.productId,
        delta: parsed.data.delta,
        reason: parsed.data.reason as InventoryAdjustmentReason,
        note: parsed.data.note ?? null,
      },
      { id: actor.id, role: actor.role.code },
    );
  } catch (error) {
    if (error instanceof ProductWriteError) {
      return { errors: { delta: error.message } };
    }
    throw error;
  }

  revalidatePath(`/admin/products/${parsed.data.productId}`);
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true, message: "Stock updated." };
}

export async function changePriceAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await authorize(PERMISSIONS.PRODUCT_PRICE_WRITE);

  const mrpRaw = formValue(formData, "mrp");
  const parsed = priceChangeSchema.safeParse({
    productId: formValue(formData, "productId"),
    sellingPriceInPaise: Math.round(formNumber(formData, "sellingPrice") * 100),
    mrpInPaise: mrpRaw === "" ? null : Math.round(Number(mrpRaw) * 100),
    reason: formValue(formData, "reason"),
  });

  if (!parsed.success) {
    return { errors: toFieldErrors(parsed.error) };
  }

  try {
    await changePrice(
      {
        productId: parsed.data.productId,
        sellingPriceInPaise: parsed.data.sellingPriceInPaise,
        mrpInPaise: parsed.data.mrpInPaise ?? null,
        reason: parsed.data.reason ?? null,
      },
      { id: actor.id, role: actor.role.code },
    );
  } catch (error) {
    if (error instanceof ProductWriteError) {
      return { errors: { sellingPrice: error.message } };
    }
    throw error;
  }

  revalidatePath(`/admin/products/${parsed.data.productId}`);
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true, message: "Price updated and recorded in the price history." };
}

/**
 * Changing a legal restriction requires its own permission and is always
 * audited. It cannot be done through the ordinary product editor.
 */
export async function setLegalRestrictionAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await authorize(PERMISSIONS.PRODUCT_LEGAL_RESTRICTION_WRITE);

  const parsed = legalRestrictionSchema.safeParse({
    productId: formValue(formData, "productId"),
    legalRestriction: formValue(formData, "legalRestriction"),
    note: formValue(formData, "note"),
  });

  if (!parsed.success) {
    return { errors: toFieldErrors(parsed.error) };
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) {
    return { errors: { productId: "Product not found." } };
  }

  const restriction = parsed.data.legalRestriction as LegalRestriction;

  await prisma.product.update({
    where: { id: product.id },
    data: {
      legalRestriction: restriction,
      legalRestrictionNote: parsed.data.note ?? null,
      legalRestrictionSetById: actor.id,
      legalRestrictionSetAt: new Date(),
      updatedById: actor.id,
      // A product that is prohibited for online sale can never be flagged as
      // eligible for online sale.
      ...(restriction === LegalRestriction.PROHIBITED_FOR_ONLINE_SALE
        ? { saleEligibility: "NOT_FOR_ONLINE_SALE" }
        : {}),
    },
  });

  const context = await requestContext();
  await recordAudit({
    action: AuditAction.PRODUCT_LEGAL_RESTRICTION_CHANGED,
    entityType: "Product",
    entityId: product.id,
    summary: `Legal restriction changed for ${product.name} (${product.sku}).`,
    actorId: actor.id,
    actorRole: actor.role.code,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      sku: product.sku,
      previous: product.legalRestriction,
      next: restriction,
      note: parsed.data.note,
    },
  });

  revalidatePath(`/admin/products/${product.id}`);
  revalidatePath("/products");
  return { ok: true, message: "Legal restriction updated." };
}
