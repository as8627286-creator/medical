import "server-only";
import { prisma } from "@/lib/db";
import { evaluateEligibility } from "@/lib/catalogue/eligibility";
import { computeLine, computeTotals, type Totals } from "@/lib/pricing";
import { getStoreSettings } from "@/lib/store/settings";

/**
 * Cart handling.
 *
 * The cart stores only product references and quantities. Prices, stock and
 * eligibility are always re-read from the catalogue when the cart is rendered
 * or checked out, so a stale browser can never influence the amount charged.
 */

export interface CartLine {
  itemId: string;
  productId: string;
  quantity: number;
  name: string;
  brand: string | null;
  strength: string | null;
  packSize: string;
  dosageForm: string;
  imageUrl: string | null;
  imageVariants: unknown;
  unitPriceInPaise: number;
  mrpInPaise: number | null;
  taxPercent: number;
  lineTotalInPaise: number;
  taxInPaise: number;
  availableQuantity: number;
  prescriptionRequired: boolean;
  sellableOnline: boolean;
  unavailableReason: string | null;
  maxQuantity: number;
}

export interface CartView {
  id: string | null;
  items: CartLine[];
  totals: Totals;
  itemCount: number;
  requiresPrescription: boolean;
  hasUnavailableItems: boolean;
  deliveryFeeInPaise: number;
  minOrderAmountInPaise: number;
}

export async function getCart(userId: string): Promise<CartView> {
  const settings = await getStoreSettings();
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                select: { url: true, variants: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return {
      id: cart?.id ?? null,
      items: [],
      totals: computeTotals({ lines: [], deliveryFeeInPaise: 0 }),
      itemCount: 0,
      requiresPrescription: false,
      hasUnavailableItems: false,
      deliveryFeeInPaise: settings.defaultDeliveryFeeInPaise,
      minOrderAmountInPaise: settings.minOrderAmountInPaise,
    };
  }

  const items: CartLine[] = cart.items.map((item) => {
    const product = item.product;
    const eligibility = evaluateEligibility({
      isActive: product.isActive,
      saleEligibility: product.saleEligibility,
      legalRestriction: product.legalRestriction,
      prescriptionRequired: product.prescriptionRequired,
      stockQuantity: product.stockQuantity,
      reservedQuantity: product.reservedQuantity,
    });

    const line = computeLine({
      unitPriceInPaise: product.sellingPriceInPaise,
      quantity: item.quantity,
      taxPercent: Number(product.taxPercent),
    });

    const available = eligibility.availableQuantity;

    return {
      itemId: item.id,
      productId: product.id,
      quantity: item.quantity,
      name: product.name,
      brand: product.brand,
      strength: product.strength,
      packSize: product.packSize,
      dosageForm: product.dosageForm,
      imageUrl: product.images[0]?.url ?? null,
      imageVariants: product.images[0]?.variants ?? null,
      unitPriceInPaise: product.sellingPriceInPaise,
      mrpInPaise: product.mrpInPaise,
      taxPercent: Number(product.taxPercent),
      lineTotalInPaise: line.lineTotalInPaise,
      taxInPaise: line.taxInPaise,
      availableQuantity: available,
      prescriptionRequired: eligibility.prescriptionRequired,
      sellableOnline: eligibility.sellableOnline,
      unavailableReason: eligibility.reason,
      maxQuantity: Math.max(1, available),
    };
  });

  const totals = computeTotals({
    lines: items.map((item) => ({
      lineTotalInPaise: item.lineTotalInPaise,
      taxInPaise: item.taxInPaise,
    })),
    deliveryFeeInPaise: settings.defaultDeliveryFeeInPaise,
  });

  return {
    id: cart.id,
    items,
    totals,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    requiresPrescription: items.some((item) => item.prescriptionRequired),
    hasUnavailableItems: items.some((item) => !item.sellableOnline),
    deliveryFeeInPaise: settings.defaultDeliveryFeeInPaise,
    minOrderAmountInPaise: settings.minOrderAmountInPaise,
  };
}

export async function getOrCreateCartId(userId: string): Promise<string> {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing.id;
  const created = await prisma.cart.create({ data: { userId } });
  return created.id;
}

export class CartError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CartError";
    this.code = code;
  }
}

export async function addToCart(
  userId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new CartError("not_found", "That product is no longer available.");
  }

  const eligibility = evaluateEligibility({
    isActive: product.isActive,
    saleEligibility: product.saleEligibility,
    legalRestriction: product.legalRestriction,
    prescriptionRequired: product.prescriptionRequired,
    stockQuantity: product.stockQuantity,
    reservedQuantity: product.reservedQuantity,
  });

  if (!eligibility.sellableOnline) {
    throw new CartError(
      "not_sellable",
      eligibility.reason ?? "That product is not available for online sale.",
    );
  }

  const cartId = await getOrCreateCartId(userId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });

  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > eligibility.availableQuantity) {
    throw new CartError(
      "insufficient_stock",
      `Only ${eligibility.availableQuantity} unit${eligibility.availableQuantity === 1 ? "" : "s"} of ${product.name} are available.`,
    );
  }

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
  } else {
    await prisma.cartItem.create({ data: { cartId, productId, quantity } });
  }
}

export async function setCartItemQuantity(
  userId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
    include: { product: true },
  });
  if (!item) {
    throw new CartError("not_found", "That cart item no longer exists.");
  }

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return;
  }

  const available = Math.max(
    0,
    item.product.stockQuantity - item.product.reservedQuantity,
  );
  if (quantity > available) {
    throw new CartError(
      "insufficient_stock",
      `Only ${available} unit${available === 1 ? "" : "s"} of ${item.product.name} are available.`,
    );
  }

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
}

export async function removeCartItem(userId: string, itemId: string): Promise<void> {
  await prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
}

export async function clearCart(userId: string): Promise<void> {
  await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
}
