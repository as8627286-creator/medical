import "server-only";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { evaluateEligibility } from "@/lib/catalogue/eligibility";
import { computeLine, computeTotals } from "@/lib/pricing";
import { getStoreSettings } from "@/lib/store/settings";
import { quoteDelivery } from "@/lib/delivery/zones";
import { PaymentMethod, OrderStatus, PrescriptionStatus } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { AuditAction } from "@/generated/prisma/enums";

/**
 * Order placement.
 *
 * Rules enforced here, on the server:
 *  - the cart is re-read and re-priced; browser totals are ignored,
 *  - every product is re-checked for sale eligibility,
 *  - stock is reserved inside the same transaction that creates the order, so
 *    two concurrent orders cannot oversell the same unit,
 *  - delivery eligibility is checked against the configured zones,
 *  - the order items store a snapshot of the catalogue values.
 */

export class OrderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OrderError";
    this.code = code;
  }
}

export interface PlaceOrderInput {
  userId: string;
  addressId: string;
  paymentMethod: PaymentMethod;
  customerNote?: string | null;
}

export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  totalInPaise: number;
  requiresPrescription: boolean;
}

function generateOrderNumber(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `MS-${stamp}-${random}`;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const settings = await getStoreSettings();

  if (!settings.salesEnabled) {
    throw new OrderError(
      "sales_disabled",
      "Online ordering is not available at the moment. Please contact the pharmacy.",
    );
  }

  const [cart, address] = await Promise.all([
    prisma.cart.findUnique({
      where: { userId: input.userId },
      include: { items: { include: { product: true } } },
    }),
    prisma.address.findFirst({ where: { id: input.addressId, userId: input.userId } }),
  ]);

  if (!address) {
    throw new OrderError("invalid_address", "Select a delivery address on your account.");
  }

  if (!cart || cart.items.length === 0) {
    throw new OrderError("empty_cart", "Your cart is empty.");
  }

  const delivery = await quoteDelivery(address.pincode);
  if (!delivery.serviceable) {
    throw new OrderError(
      "not_serviceable",
      delivery.reason ?? "We do not deliver to this PIN code yet.",
    );
  }

  // Re-price and re-check every line on the server.
  const lines = cart.items.map((item) => {
    const product = item.product;
    const eligibility = evaluateEligibility({
      isActive: product.isActive,
      saleEligibility: product.saleEligibility,
      legalRestriction: product.legalRestriction,
      prescriptionRequired: product.prescriptionRequired,
      stockQuantity: product.stockQuantity,
      reservedQuantity: product.reservedQuantity,
    });

    if (!eligibility.sellableOnline) {
      throw new OrderError(
        "not_sellable",
        `${product.name} is no longer available for online sale. Please remove it from your cart.`,
      );
    }
    if (item.quantity > eligibility.availableQuantity) {
      throw new OrderError(
        "insufficient_stock",
        `Only ${eligibility.availableQuantity} unit${
          eligibility.availableQuantity === 1 ? "" : "s"
        } of ${product.name} are available. Please update your cart.`,
      );
    }

    const computed = computeLine({
      unitPriceInPaise: product.sellingPriceInPaise,
      quantity: item.quantity,
      taxPercent: Number(product.taxPercent),
    });

    return {
      product,
      quantity: item.quantity,
      unitPriceInPaise: product.sellingPriceInPaise,
      taxPercent: Number(product.taxPercent),
      lineTotalInPaise: computed.lineTotalInPaise,
      taxInPaise: computed.taxInPaise,
      prescriptionRequired: eligibility.prescriptionRequired,
    };
  });

  const totals = computeTotals({
    lines: lines.map((line) => ({
      lineTotalInPaise: line.lineTotalInPaise,
      taxInPaise: line.taxInPaise,
    })),
    deliveryFeeInPaise: delivery.deliveryFeeInPaise,
  });

  if (totals.subtotalInPaise < delivery.minOrderAmountInPaise) {
    throw new OrderError(
      "below_minimum",
      `The minimum order value for this PIN code is ₹${(
        delivery.minOrderAmountInPaise / 100
      ).toFixed(0)}.`,
    );
  }

  const requiresPrescription = lines.some((line) => line.prescriptionRequired);
  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    // Reserve stock: the conditional update is the concurrency control. If two
    // transactions race for the last unit, only one of them sees the expected
    // stock value and the other fails.
    for (const line of lines) {
      const result = await tx.product.updateMany({
        where: {
          id: line.product.id,
          stockQuantity: { gte: line.quantity + line.product.reservedQuantity },
          isActive: true,
        },
        data: { reservedQuantity: { increment: line.quantity } },
      });

      if (result.count === 0) {
        throw new OrderError(
          "insufficient_stock",
          `${line.product.name} sold out while your order was being placed. Please review your cart.`,
        );
      }
    }

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: input.userId,
        status: requiresPrescription
          ? OrderStatus.AWAITING_PRESCRIPTION_APPROVAL
          : OrderStatus.PENDING,
        paymentMethod: input.paymentMethod,
        subtotalInPaise: totals.subtotalInPaise,
        deliveryFeeInPaise: totals.deliveryFeeInPaise,
        taxInPaise: totals.taxInPaise,
        discountInPaise: totals.discountInPaise,
        totalInPaise: totals.totalInPaise,
        deliveryName: address.fullName,
        deliveryPhone: address.phone,
        deliveryLine1: address.line1,
        deliveryLine2: address.line2,
        deliveryLandmark: address.landmark,
        deliveryCity: address.city,
        deliveryState: address.state,
        deliveryPincode: address.pincode,
        deliveryZoneId: delivery.zoneId,
        estimatedDeliveryDaysMin: delivery.estimatedDaysMin,
        estimatedDeliveryDaysMax: delivery.estimatedDaysMax,
        requiresPrescription,
        prescriptionsApproved: !requiresPrescription,
        customerNote: input.customerNote ?? null,
        items: {
          create: lines.map((line) => ({
            productId: line.product.id,
            productName: line.product.name,
            productBrand: line.product.brand,
            productSku: line.product.sku,
            productManufacturer: line.product.manufacturer,
            productStrength: line.product.strength,
            productDosageForm: line.product.dosageForm,
            productPackSize: line.product.packSize,
            unitPriceInPaise: line.unitPriceInPaise,
            taxPercent: line.taxPercent,
            taxInPaise: line.taxInPaise,
            quantity: line.quantity,
            lineTotalInPaise: line.lineTotalInPaise,
            prescriptionRequired: line.prescriptionRequired,
            prescriptionRequirement: line.prescriptionRequired
              ? { create: { status: PrescriptionStatus.AWAITING_UPLOAD } }
              : undefined,
          })),
        },
        delivery: { create: { status: "PENDING", zoneId: delivery.zoneId } },
      },
    });

    // The cart is emptied in the same transaction.
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  await recordAudit({
    action: AuditAction.ORDER_PLACED,
    entityType: "Order",
    entityId: order.id,
    summary: `Order ${order.orderNumber} placed (${order.paymentMethod}).`,
    actorId: input.userId,
    metadata: {
      orderNumber: order.orderNumber,
      totalInPaise: order.totalInPaise,
      paymentMethod: order.paymentMethod,
      requiresPrescription,
    },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalInPaise: order.totalInPaise,
    requiresPrescription,
  };
}

export async function cancelOrder(params: {
  orderId: string;
  reason: string;
  actorId: string;
  actorRole: string;
  cancelledBy: "CUSTOMER" | "STAFF";
}): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { items: true },
  });

  if (!order) {
    throw new OrderError("not_found", "Order not found.");
  }

  if (
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.DELIVERED
  ) {
    throw new OrderError(
      "not_cancellable",
      `An order that is ${order.status.toLowerCase().replace(/_/g, " ")} cannot be cancelled.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.productId) continue;
      await tx.product.updateMany({
        where: { id: item.productId },
        data: { reservedQuantity: { decrement: item.quantity } },
      });
      await tx.inventoryAdjustment.create({
        data: {
          productId: item.productId,
          delta: 0,
          stockAfter: 0,
          reason: "RESERVATION_RELEASE",
          note: `Stock released when order ${order.orderNumber} was cancelled.`,
          orderId: order.id,
          createdById: params.actorId,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: params.reason,
      },
    });
  });

  await recordAudit({
    action: AuditAction.ORDER_CANCELLED,
    entityType: "Order",
    entityId: order.id,
    summary: `Order ${order.orderNumber} cancelled by ${params.cancelledBy.toLowerCase()}.`,
    actorId: params.actorId,
    actorRole: params.actorRole,
    metadata: { reason: params.reason, cancelledBy: params.cancelledBy },
  });
}

export async function listOrdersForUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    include: {
      items: { select: { id: true, productName: true, quantity: true, productId: true } },
      payments: { select: { id: true, status: true, method: true, amountInPaise: true } },
    },
  });
}

export async function getOrderForUser(orderNumber: string, userId: string) {
  return prisma.order.findFirst({
    where: { orderNumber, userId },
    include: {
      items: { include: { prescriptionRequirement: true } },
      payments: { orderBy: { createdAt: "desc" } },
      delivery: true,
      prescriptions: { select: { id: true, uploadedAt: true } },
    },
  });
}

export function paymentProvidersConfigured(): { live: boolean; provider: string } {
  const env = getEnv();
  return {
    live: env.PAYMENT_LIVE,
    provider: env.PAYMENT_PROVIDER,
  };
}
