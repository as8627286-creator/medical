import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../helpers/db";
import { createProduct } from "@/lib/catalogue/write";
import { placeOrder, cancelOrder, OrderError } from "@/lib/orders/service";
import { hashPassword } from "@/lib/auth/password";
import { ADMIN_PERMISSIONS, CUSTOMER_PERMISSIONS } from "@/lib/auth/rbac";
import { DosageForm, LegalRestriction, OrderStatus, PaymentMethod, SaleEligibility } from "@/generated/prisma/enums";
import { quoteDelivery } from "@/lib/delivery/zones";
import { reviewPrescription, orderIsClearedForDispatch } from "@/lib/prescriptions/service";

const actor = { id: "", role: "ADMIN" };

async function seed() {
  const adminRole = await prisma.role.create({
    data: { code: "ADMIN", name: "Administrator", permissions: ADMIN_PERMISSIONS, isSystem: true },
  });
  const customerRole = await prisma.role.create({
    data: { code: "CUSTOMER", name: "Customer", permissions: CUSTOMER_PERMISSIONS, isSystem: true },
  });
  const admin = await prisma.user.create({
    data: {
      email: "admin@test.local",
      fullName: "Test Admin",
      passwordHash: await hashPassword("TestPassword#2026"),
      roleId: adminRole.id,
    },
  });
  const customer = await prisma.user.create({
    data: {
      email: "customer@test.local",
      fullName: "Test Customer",
      passwordHash: await hashPassword("TestPassword#2026"),
      roleId: customerRole.id,
    },
  });
  actor.id = admin.id;

  const category = await prisma.productCategory.create({
    data: { name: "Test category", slug: "test-category" },
  });

  await prisma.storeSettings.create({
    data: {
      id: 1,
      pharmacyName: "Test Pharmacy",
      salesEnabled: true,
      codEnabled: true,
      minOrderAmountInPaise: 0,
      defaultDeliveryFeeInPaise: 5000,
    },
  });

  const zone = await prisma.deliveryZone.create({
    data: {
      name: "Test zone",
      deliveryFeeInPaise: 5000,
      minOrderAmountInPaise: 0,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
    },
  });
  await prisma.deliveryZonePincode.create({
    data: { pincode: "560001", zoneId: zone.id },
  });

  const address = await prisma.address.create({
    data: {
      userId: customer.id,
      fullName: "Test Customer",
      phone: "9000000000",
      line1: "1 Test Street",
      city: "Test City",
      state: "Test State",
      pincode: "560001",
    },
  });

  return { admin, customer, category, address, zone };
}

function productInput(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Product",
    brand: "Test Brand",
    manufacturer: "Test Manufacturer",
    strength: "500 mg",
    dosageForm: DosageForm.TABLET,
    packSize: "10",
    packUnit: "tablets",
    sku: "ORD-001",
    description: null,
    warnings: null,
    usageInformation: null,
    storageInstructions: null,
    additionalInfo: null,
    mrpInPaise: 1500,
    sellingPriceInPaise: 1250,
    taxPercent: 12,
    stockQuantity: 10,
    lowStockThreshold: 2,
    categoryId,
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    isActive: true,
    ...overrides,
  } as never;
}

describe("placing an order", () => {
  let context: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    context = await seed();
  });

  it("prices the order on the server and ignores anything the browser sends", async () => {
    const product = await createProduct(productInput(context.category.id), actor);
    const cart = await prisma.cart.create({ data: { userId: context.customer.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 2 },
    });

    const placed = await placeOrder({
      userId: context.customer.id,
      addressId: context.address.id,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: placed.orderId },
      include: { items: true },
    });

    // 2 x 1250 paise + 5000 paise delivery
    expect(order.subtotalInPaise).toBe(2500);
    expect(order.deliveryFeeInPaise).toBe(5000);
    expect(order.totalInPaise).toBe(7500);
    expect(order.items[0]!.unitPriceInPaise).toBe(1250);
    expect(order.items[0]!.productName).toBe("Test Product");
  });

  it("snapshots the catalogue values on the order item", async () => {
    const product = await createProduct(productInput(context.category.id), actor);
    const cart = await prisma.cart.create({ data: { userId: context.customer.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 1 },
    });

    const placed = await placeOrder({
      userId: context.customer.id,
      addressId: context.address.id,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    // The catalogue changes after the order was placed.
    await prisma.product.update({
      where: { id: product.id },
      data: { name: "Renamed", sellingPriceInPaise: 999 },
    });

    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: placed.orderId } });
    expect(item.productName).toBe("Test Product");
    expect(item.unitPriceInPaise).toBe(1250);
  });

  it("empties the cart when the order is placed", async () => {
    const product = await createProduct(productInput(context.category.id), actor);
    const cart = await prisma.cart.create({ data: { userId: context.customer.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 1 },
    });

    await placeOrder({
      userId: context.customer.id,
      addressId: context.address.id,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
  });

  it("refuses an address in a PIN code that is not serviceable", async () => {
    const product = await createProduct(productInput(context.category.id), actor);
    const cart = await prisma.cart.create({ data: { userId: context.customer.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 1 },
    });
    const otherAddress = await prisma.address.create({
      data: {
        userId: context.customer.id,
        fullName: "Test Customer",
        phone: "9000000000",
        line1: "2 Other Street",
        city: "Other City",
        state: "Other State",
        pincode: "999999",
      },
    });

    await expect(
      placeOrder({
        userId: context.customer.id,
        addressId: otherAddress.id,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      }),
    ).rejects.toBeInstanceOf(OrderError);
  });

  it("refuses to sell a product that is prohibited for online sale", async () => {
    const product = await createProduct(
      productInput(context.category.id, {
        sku: "ORD-PROHIBITED",
        legalRestriction: LegalRestriction.PROHIBITED_FOR_ONLINE_SALE,
        saleEligibility: SaleEligibility.NOT_FOR_ONLINE_SALE,
      }),
      actor,
    );
    const cart = await prisma.cart.create({ data: { userId: context.customer.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 1 },
    });

    await expect(
      placeOrder({
        userId: context.customer.id,
        addressId: context.address.id,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      }),
    ).rejects.toBeInstanceOf(OrderError);
  });

  it("does not oversell: a second order for the last unit is refused", async () => {
    const product = await createProduct(
      productInput(context.category.id, { sku: "ORD-002", stockQuantity: 1 }),
      actor,
    );
    const cart = await prisma.cart.create({ data: { userId: context.customer.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 1 },
    });

    await placeOrder({
      userId: context.customer.id,
      addressId: context.address.id,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    // A second customer wants the same (already reserved) unit.
    const other = await prisma.user.create({
      data: {
        email: "customer2@test.local",
        fullName: "Second Customer",
        passwordHash: await hashPassword("TestPassword#2026"),
        roleId: (await prisma.role.findFirstOrThrow({ where: { code: "CUSTOMER" } })).id,
      },
    });
    const otherAddress = await prisma.address.create({
      data: {
        userId: other.id,
        fullName: "Second Customer",
        phone: "9000000001",
        line1: "3 Test Street",
        city: "Test City",
        state: "Test State",
        pincode: "560001",
      },
    });
    const otherCart = await prisma.cart.create({ data: { userId: other.id } });
    await prisma.cartItem.create({
      data: { cartId: otherCart.id, productId: product.id, quantity: 1 },
    });

    await expect(
      placeOrder({
        userId: other.id,
        addressId: otherAddress.id,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      }),
    ).rejects.toBeInstanceOf(OrderError);

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.reservedQuantity).toBe(1);
  });

  it("releases the reserved stock when the order is cancelled", async () => {
    const product = await createProduct(
      productInput(context.category.id, { sku: "ORD-003", stockQuantity: 5 }),
      actor,
    );
    const cart = await prisma.cart.create({ data: { userId: context.customer.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 3 },
    });

    const placed = await placeOrder({
      userId: context.customer.id,
      addressId: context.address.id,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    let updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.reservedQuantity).toBe(3);

    await cancelOrder({
      orderId: placed.orderId,
      reason: "Changed my mind",
      actorId: context.customer.id,
      actorRole: "CUSTOMER",
      cancelledBy: "CUSTOMER",
    });

    updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.reservedQuantity).toBe(0);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: placed.orderId } });
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(order.cancelReason).toBe("Changed my mind");
  });
});

describe("prescription-gated orders", () => {
  let context: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    context = await seed();
  });

  it("puts a prescription order on hold and blocks it until a pharmacist approves", async () => {
    const product = await createProduct(
      productInput(context.category.id, {
        sku: "RX-001",
        prescriptionRequired: true,
        saleEligibility: SaleEligibility.PRESCRIPTION_REQUIRED,
        legalRestriction: LegalRestriction.PRESCRIPTION_ONLY,
      }),
      actor,
    );
    const cart = await prisma.cart.create({ data: { userId: context.customer.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 1 },
    });

    const placed = await placeOrder({
      userId: context.customer.id,
      addressId: context.address.id,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: placed.orderId } });
    expect(order.requiresPrescription).toBe(true);
    expect(order.prescriptionsApproved).toBe(false);
    expect(order.status).toBe(OrderStatus.AWAITING_PRESCRIPTION_APPROVAL);

    // The order is not cleared for dispatch.
    expect(await orderIsClearedForDispatch(order.id)).toBe(false);

    const requirement = await prisma.prescriptionRequirement.findFirstOrThrow({
      where: { orderItem: { orderId: order.id } },
    });
    expect(requirement.status).toBe("AWAITING_UPLOAD");

    // A pharmacist approves the prescription.
    await reviewPrescription({
      requirementId: requirement.id,
      decision: "APPROVED",
      reason: "Prescription verified",
      reviewerId: context.admin.id,
      reviewerRole: "ADMIN",
    });

    expect(await orderIsClearedForDispatch(order.id)).toBe(true);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.prescriptionsApproved).toBe(true);
    expect(updated.status).toBe(OrderStatus.CONFIRMED);

    const reviews = await prisma.prescriptionReview.findMany({
      where: { requirementId: requirement.id },
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]!.reviewerId).toBe(context.admin.id);
    expect(reviews[0]!.decision).toBe("APPROVED");
  });

  it("keeps a rejected prescription on hold and records the reason", async () => {
    const product = await createProduct(
      productInput(context.category.id, {
        sku: "RX-002",
        prescriptionRequired: true,
        saleEligibility: SaleEligibility.PRESCRIPTION_REQUIRED,
      }),
      actor,
    );
    const cart = await prisma.cart.create({ data: { userId: context.customer.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 1 },
    });

    const placed = await placeOrder({
      userId: context.customer.id,
      addressId: context.address.id,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    const requirement = await prisma.prescriptionRequirement.findFirstOrThrow({
      where: { orderItem: { orderId: placed.orderId } },
    });

    await reviewPrescription({
      requirementId: requirement.id,
      decision: "REJECTED",
      reason: "The prescription is not legible",
      reviewerId: context.admin.id,
      reviewerRole: "ADMIN",
    });

    const updatedRequirement = await prisma.prescriptionRequirement.findUniqueOrThrow({
      where: { id: requirement.id },
    });
    expect(updatedRequirement.status).toBe("REJECTED");
    expect(await orderIsClearedForDispatch(placed.orderId)).toBe(false);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: placed.orderId } });
    expect(order.status).toBe(OrderStatus.AWAITING_PRESCRIPTION_APPROVAL);
    expect(order.prescriptionsApproved).toBe(false);
  });
});

describe("delivery quotes", () => {
  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("reports a PIN code outside every zone as not serviceable", async () => {
    await seed();
    const quote = await quoteDelivery("123456");
    expect(quote.serviceable).toBe(false);
    expect(quote.reason).toBeTruthy();
  });

  it("uses the zone fee and window for a serviceable PIN code", async () => {
    await seed();
    const quote = await quoteDelivery("560001");
    expect(quote.serviceable).toBe(true);
    expect(quote.deliveryFeeInPaise).toBe(5000);
    expect(quote.estimatedWindow).toBe("1 to 2 days");
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
