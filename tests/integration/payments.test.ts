import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../helpers/db";
import { hashPassword } from "@/lib/auth/password";
import { CUSTOMER_PERMISSIONS } from "@/lib/auth/rbac";
import {
  createPaymentForOrder,
  verifyPaymentForOrder,
  processWebhookEvent,
  getPaymentProvider,
  confirmCashCollection,
} from "@/lib/payments/service";
import { SandboxPaymentProvider } from "@/lib/payments/sandbox";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";

async function seedOrder(paymentMethod: PaymentMethod = PaymentMethod.ONLINE) {
  const role = await prisma.role.create({
    data: { code: "CUSTOMER", name: "Customer", permissions: CUSTOMER_PERMISSIONS, isSystem: true },
  });
  const user = await prisma.user.create({
    data: {
      email: "payer@test.local",
      fullName: "Test Payer",
      passwordHash: await hashPassword("TestPassword#2026"),
      roleId: role.id,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: "MS-TEST-0001",
      userId: user.id,
      status: "PENDING",
      paymentMethod,
      subtotalInPaise: 2500,
      deliveryFeeInPaise: 5000,
      taxInPaise: 0,
      totalInPaise: 7500,
      deliveryName: "Test Payer",
      deliveryPhone: "9000000000",
      deliveryLine1: "1 Test Street",
      deliveryCity: "Test City",
      deliveryState: "Test State",
      deliveryPincode: "560001",
    },
  });
  return { user, order };
}

describe("online payments", () => {
  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("creates a payment session on the server", async () => {
    const { user, order } = await seedOrder();

    const { paymentId, session } = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000/orders/MS-TEST-0001",
    });

    expect(paymentId).toBeTruthy();
    expect(session.providerOrderId).toContain("sbx_order_");
    expect(session.amountInPaise).toBe(7500);
    expect(session.status).toBe(PaymentStatus.INITIATED);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.amountInPaise).toBe(7500);
    expect(payment.idempotencyKey).toBeTruthy();
  });

  it("reuses the existing payment instead of creating a second one", async () => {
    const { user, order } = await seedOrder();

    const first = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000",
    });
    const second = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000",
    });

    expect(second.paymentId).toBe(first.paymentId);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("captures the payment when the server verifies a valid signature", async () => {
    const { user, order } = await seedOrder();
    const { paymentId, session } = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000",
    });

    const result = await verifyPaymentForOrder({
      paymentId,
      providerOrderId: session.providerOrderId,
      providerPaymentId: session.providerPaymentId,
      signature: session.clientInstruction?.signature ?? null,
      actorId: user.id,
    });

    expect(result.status).toBe(PaymentStatus.CAPTURED);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe(PaymentStatus.CAPTURED);
    expect(payment.capturedAt).toBeInstanceOf(Date);

    // The order moves on to confirmed.
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("CONFIRMED");
  });

  it("refuses a payment with an invalid signature", async () => {
    const { user, order } = await seedOrder();
    const { paymentId } = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000",
    });

    const result = await verifyPaymentForOrder({
      paymentId,
      providerOrderId: `sbx_order_7500.INR.forged`,
      providerPaymentId: "sbx_pay_forged",
      signature: "not-a-valid-signature",
      actorId: user.id,
    });

    expect(result.status).toBe(PaymentStatus.FAILED);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe(PaymentStatus.FAILED);
    expect(payment.failureCode).toBe("signature_mismatch");
  });

  it("does not capture a payment that was already captured", async () => {
    const { user, order } = await seedOrder();
    const { paymentId, session } = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000",
    });

    await verifyPaymentForOrder({
      paymentId,
      providerOrderId: session.providerOrderId,
      providerPaymentId: session.providerPaymentId,
      signature: session.clientInstruction?.signature ?? null,
    });

    const second = await verifyPaymentForOrder({
      paymentId,
      providerOrderId: session.providerOrderId,
      providerPaymentId: session.providerPaymentId,
      signature: session.clientInstruction?.signature ?? null,
    });

    expect(second.message).toContain("already captured");
    expect(
      await prisma.payment.count({ where: { orderId: order.id, status: PaymentStatus.CAPTURED } }),
    ).toBe(1);
  });

  it("does not capture a payment whose reference does not match the order", async () => {
    const { user, order } = await seedOrder();
    const { paymentId } = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000",
    });

    const result = await verifyPaymentForOrder({
      paymentId,
      providerOrderId: "sbx_order_999.INR.other",
      providerPaymentId: "sbx_pay_other",
      signature: "wrong",
    });

    expect(result.status).toBe(PaymentStatus.FAILED);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe(PaymentStatus.FAILED);
    expect(payment.capturedAt).toBeNull();

    // The order is not confirmed on the strength of a failed payment.
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("PENDING");
  });
});

describe("webhooks", () => {
  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("processes a correctly signed event", async () => {
    const { user, order } = await seedOrder();
    const { session } = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000",
    });

    const provider = new SandboxPaymentProvider("test-secret");
    const payload = JSON.stringify({
      id: "evt_1",
      type: "payment.captured",
      payment: {
        id: session.providerPaymentId,
        order_id: session.providerOrderId,
        status: "captured",
        amount: 7500,
        currency: "INR",
      },
    });

    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", "test-secret").update(payload).digest("hex");

    const result = await processWebhookEvent({
      provider,
      rawBody: payload,
      headers: new Headers({ "x-sandbox-signature": signature }),
    });

    expect(result.status).toBe("processed");

    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe(PaymentStatus.CAPTURED);
  });

  it("ignores a duplicate event", async () => {
    const { user, order } = await seedOrder();
    await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000",
    });

    const provider = new SandboxPaymentProvider("test-secret");
    const payload = JSON.stringify({
      id: "evt_duplicate",
      type: "payment.captured",
      payment: { id: "sbx_pay_x", order_id: "sbx_order_7500.INR.x", status: "captured" },
    });
    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", "test-secret").update(payload).digest("hex");
    const headers = new Headers({ "x-sandbox-signature": signature });

    const first = await processWebhookEvent({ provider, rawBody: payload, headers });
    const second = await processWebhookEvent({ provider, rawBody: payload, headers });

    expect(first.status).toBe("processed");
    expect(second.status).toBe("duplicate");
    expect(await prisma.paymentWebhookEvent.count()).toBe(1);
  });

  it("rejects an event with an invalid signature", async () => {
    const { user, order } = await seedOrder();
    await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.ONLINE,
      returnUrl: "http://localhost:3000",
    });

    const provider = new SandboxPaymentProvider("test-secret");
    const payload = JSON.stringify({ id: "evt_bad", type: "payment.captured" });

    const result = await processWebhookEvent({
      provider,
      rawBody: payload,
      headers: new Headers({ "x-sandbox-signature": "invalid" }),
    });

    expect(result.status).toBe("rejected");

    const events = await prisma.paymentWebhookEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]!.signatureValid).toBe(false);
    expect(events[0]!.status).toBe("REJECTED");
  });
});

describe("cash on delivery", () => {
  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("keeps the payment pending until the collection is confirmed", async () => {
    const { user, order } = await seedOrder(PaymentMethod.CASH_ON_DELIVERY);

    const { paymentId } = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.CASH_ON_DELIVERY,
      returnUrl: "http://localhost:3000",
    });

    let payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.providerPaymentId).toBeNull();

    await confirmCashCollection({
      orderId: order.id,
      actorId: user.id,
      actorRole: "ADMIN",
    });

    payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe(PaymentStatus.CAPTURED);
    expect(payment.capturedAt).toBeInstanceOf(Date);
  });

  it("does not treat a browser claim as proof of payment", async () => {
    const { user, order } = await seedOrder(PaymentMethod.CASH_ON_DELIVERY);
    const { paymentId } = await createPaymentForOrder({
      orderId: order.id,
      userId: user.id,
      method: PaymentMethod.CASH_ON_DELIVERY,
      returnUrl: "http://localhost:3000",
    });

    const result = await verifyPaymentForOrder({
      paymentId,
      providerOrderId: "cod_anything",
      providerPaymentId: "anything",
      signature: "anything",
    });

    expect(result.status).toBe(PaymentStatus.PENDING);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe(PaymentStatus.PENDING);
  });
});

describe("provider selection", () => {
  it("uses the sandbox provider by default", () => {
    const provider = getPaymentProvider(PaymentMethod.ONLINE);
    expect(provider.code).toBe("SANDBOX");
    expect(provider.live).toBe(false);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
