import "server-only";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { AuditAction, InventoryAdjustmentReason } from "@/generated/prisma/enums";
import { buildSearchText } from "./products";
import type { ProductCreateInput, ProductUpdateInput } from "@/lib/validation/catalogue";

/**
 * Catalogue write operations.
 *
 * Every mutation:
 *  - is executed inside a database transaction,
 *  - writes a history row (price history, stock adjustment),
 *  - writes an audit event.
 *
 * Product totals are never derived from client input: the selling price is
 * validated here and stored as an integer number of paise.
 */

export interface Actor {
  id: string;
  role: string;
}

export class ProductWriteError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ProductWriteError";
    this.code = code;
  }
}

export async function createProduct(input: ProductCreateInput, actor: Actor) {
  const searchText = buildSearchText(input);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { sku: input.sku } });
    if (existing) {
      throw new ProductWriteError("duplicate_sku", `SKU ${input.sku} is already in use.`);
    }

    const product = await tx.product.create({
      data: {
        sku: input.sku,
        name: input.name,
        brand: input.brand ?? null,
        manufacturer: input.manufacturer,
        strength: input.strength ?? null,
        dosageForm: input.dosageForm,
        packSize: input.packSize,
        packUnit: input.packUnit ?? null,
        description: input.description ?? null,
        warnings: input.warnings ?? null,
        usageInformation: input.usageInformation ?? null,
        storageInstructions: input.storageInstructions ?? null,
        additionalInfo: input.additionalInfo ?? null,
        mrpInPaise: input.mrpInPaise ?? null,
        sellingPriceInPaise: input.sellingPriceInPaise,
        taxPercent: input.taxPercent,
        stockQuantity: input.stockQuantity,
        lowStockThreshold: input.lowStockThreshold,
        categoryId: input.categoryId,
        isActive: input.isActive,
        prescriptionRequired: input.prescriptionRequired,
        saleEligibility: input.saleEligibility,
        searchText,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });

    if (input.stockQuantity > 0) {
      await tx.inventoryAdjustment.create({
        data: {
          productId: product.id,
          delta: input.stockQuantity,
          stockAfter: input.stockQuantity,
          reason: InventoryAdjustmentReason.CORRECTION,
          note: "Opening stock on product creation.",
          createdById: actor.id,
        },
      });
    }

    await tx.priceHistory.create({
      data: {
        productId: product.id,
        previousPriceInPaise: input.sellingPriceInPaise,
        newPriceInPaise: input.sellingPriceInPaise,
        previousMrpInPaise: input.mrpInPaise ?? null,
        newMrpInPaise: input.mrpInPaise ?? null,
        reason: "Initial price on product creation.",
        changedById: actor.id,
      },
    });

    return product;
  });
}

export async function updateProduct(input: ProductUpdateInput, actor: Actor) {
  const product = await prisma.product.findUnique({ where: { id: input.id } });
  if (!product) {
    throw new ProductWriteError("not_found", "Product not found.");
  }

  const nextName = input.name ?? product.name;
  const nextBrand = input.brand === undefined ? product.brand : input.brand;
  const nextManufacturer = input.manufacturer ?? product.manufacturer;
  const nextStrength = input.strength === undefined ? product.strength : input.strength;
  const nextPackSize = input.packSize ?? product.packSize;
  const searchText = buildSearchText({
    name: nextName,
    brand: nextBrand,
    manufacturer: nextManufacturer,
    strength: nextStrength,
    packSize: nextPackSize,
  });

  return prisma.$transaction(async (tx) => {
    if (input.sku && input.sku !== product.sku) {
      const clash = await tx.product.findUnique({ where: { sku: input.sku } });
      if (clash) {
        throw new ProductWriteError("duplicate_sku", `SKU ${input.sku} is already in use.`);
      }
    }

    const nextPrice = input.sellingPriceInPaise ?? product.sellingPriceInPaise;
    const nextMrp = input.mrpInPaise === undefined ? product.mrpInPaise : input.mrpInPaise;

    const updated = await tx.product.update({
      where: { id: product.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
        ...(input.strength !== undefined ? { strength: input.strength } : {}),
        ...(input.dosageForm !== undefined ? { dosageForm: input.dosageForm } : {}),
        ...(input.packSize !== undefined ? { packSize: input.packSize } : {}),
        ...(input.packUnit !== undefined ? { packUnit: input.packUnit } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.warnings !== undefined ? { warnings: input.warnings } : {}),
        ...(input.usageInformation !== undefined ? { usageInformation: input.usageInformation } : {}),
        ...(input.storageInstructions !== undefined
          ? { storageInstructions: input.storageInstructions }
          : {}),
        ...(input.additionalInfo !== undefined ? { additionalInfo: input.additionalInfo } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.prescriptionRequired !== undefined
          ? { prescriptionRequired: input.prescriptionRequired }
          : {}),
        ...(input.saleEligibility !== undefined
          ? { saleEligibility: input.saleEligibility }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.lowStockThreshold !== undefined
          ? { lowStockThreshold: input.lowStockThreshold }
          : {}),
        searchText,
        updatedById: actor.id,
      },
    });

    // A price change made through the editor is still recorded in the price
    // history, so that the price history is complete regardless of which
    // screen the change came from.
    if (nextPrice !== product.sellingPriceInPaise || nextMrp !== product.mrpInPaise) {
      await tx.product.update({
        where: { id: product.id },
        data: { sellingPriceInPaise: nextPrice, mrpInPaise: nextMrp },
      });
      await tx.priceHistory.create({
        data: {
          productId: product.id,
          previousPriceInPaise: product.sellingPriceInPaise,
          newPriceInPaise: nextPrice,
          previousMrpInPaise: product.mrpInPaise,
          newMrpInPaise: nextMrp,
          reason: "Price changed while editing the product.",
          changedById: actor.id,
        },
      });
    }

    if (input.stockQuantity !== undefined && input.stockQuantity !== product.stockQuantity) {
      const delta = input.stockQuantity - product.stockQuantity;
      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: input.stockQuantity },
      });
      await tx.inventoryAdjustment.create({
        data: {
          productId: product.id,
          delta,
          stockAfter: input.stockQuantity,
          reason: InventoryAdjustmentReason.CORRECTION,
          note: "Stock changed while editing the product.",
          createdById: actor.id,
        },
      });
    }

    return updated;
  });
}

export async function setProductActive(
  productId: string,
  isActive: boolean,
  actor: Actor,
): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ProductWriteError("not_found", "Product not found.");

  await prisma.product.update({
    where: { id: productId },
    data: { isActive, updatedById: actor.id },
  });

  await recordAudit({
    action: isActive ? AuditAction.PRODUCT_ACTIVATED : AuditAction.PRODUCT_DEACTIVATED,
    entityType: "Product",
    entityId: productId,
    summary: `${isActive ? "Activated" : "Deactivated"} product ${product.name} (${product.sku}).`,
    actorId: actor.id,
    actorRole: actor.role,
    metadata: { sku: product.sku, name: product.name },
  });
}

/**
 * Records a price change with the previous price, the new price, the actor and
 * the timestamp.
 */
export async function changePrice(
  params: {
    productId: string;
    sellingPriceInPaise: number;
    mrpInPaise?: number | null;
    reason?: string | null;
  },
  actor: Actor,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: params.productId } });
    if (!product) throw new ProductWriteError("not_found", "Product not found.");

    const nextMrp = params.mrpInPaise === undefined ? product.mrpInPaise : params.mrpInPaise;

    await tx.product.update({
      where: { id: product.id },
      data: {
        sellingPriceInPaise: params.sellingPriceInPaise,
        mrpInPaise: nextMrp,
        updatedById: actor.id,
      },
    });

    await tx.priceHistory.create({
      data: {
        productId: product.id,
        previousPriceInPaise: product.sellingPriceInPaise,
        newPriceInPaise: params.sellingPriceInPaise,
        previousMrpInPaise: product.mrpInPaise,
        newMrpInPaise: nextMrp,
        reason: params.reason ?? null,
        changedById: actor.id,
      },
    });

    await recordAudit({
      action: AuditAction.PRODUCT_PRICE_CHANGED,
      entityType: "Product",
      entityId: product.id,
      summary: `Price changed for ${product.name} (${product.sku}).`,
      actorId: actor.id,
      actorRole: actor.role,
      metadata: {
        sku: product.sku,
        previousPriceInPaise: product.sellingPriceInPaise,
        newPriceInPaise: params.sellingPriceInPaise,
      },
    });
  });
}

/**
 * Applies a stock adjustment.
 *
 * The update is conditional on the current stock value, so two concurrent
 * adjustments cannot silently overwrite each other (optimistic locking).
 */
export async function adjustStock(
  params: {
    productId: string;
    delta: number;
    reason: InventoryAdjustmentReason;
    note?: string | null;
  },
  actor: Actor,
): Promise<{ stockQuantity: number }> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: params.productId } });
    if (!product) throw new ProductWriteError("not_found", "Product not found.");

    const nextStock = product.stockQuantity + params.delta;
    if (nextStock < 0) {
      throw new ProductWriteError(
        "insufficient_stock",
        "The adjustment would make the stock negative. Use a positive correction instead.",
      );
    }
    if (nextStock < product.reservedQuantity) {
      throw new ProductWriteError(
        "reserved_stock",
        "The adjustment would reduce the stock below the quantity reserved by open orders.",
      );
    }

    const updated = await tx.product.updateMany({
      where: { id: product.id, stockQuantity: product.stockQuantity },
      data: { stockQuantity: nextStock, updatedById: actor.id },
    });

    if (updated.count === 0) {
      throw new ProductWriteError(
        "concurrent_update",
        "The stock was changed by someone else. Reload the product and try again.",
      );
    }

    await tx.inventoryAdjustment.create({
      data: {
        productId: product.id,
        delta: params.delta,
        stockAfter: nextStock,
        reason: params.reason,
        note: params.note ?? null,
        createdById: actor.id,
      },
    });

    await recordAudit({
      action: AuditAction.PRODUCT_STOCK_ADJUSTED,
      entityType: "Product",
      entityId: product.id,
      summary: `Stock adjusted for ${product.name} (${product.sku}).`,
      actorId: actor.id,
      actorRole: actor.role,
      metadata: {
        sku: product.sku,
        delta: params.delta,
        stockAfter: nextStock,
        reason: params.reason,
      },
    });

    return { stockQuantity: nextStock };
  });
}
