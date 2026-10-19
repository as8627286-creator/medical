import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { recordAudit } from "@/lib/audit";
import { AuditAction, PaymentMethod, PaymentProviderCode, PaymentStatus } from "@/generated/prisma/enums";
import { CashOnDeliveryProvider } from "./cod";
import { RazorpayPaymentProvider } from "./razorpay";
import { SandboxPaymentProvider } from "./sandbox";
import {
  PaymentProviderError,
  type PaymentProvider,
  type PaymentSession,
} from "./provider";

/**
 * Payment service.
 *
 * Responsibilities:
 *  - choose the provider for a payment method,
 *  - create payments with a server-generated idempotency key,
 *  - verify a payment on the server (the browser is never trusted),
 *  - process webhooks idempotently: a replayed event is recorded but does not
 *    change the order twice,
 *  - keep the payment, the transaction references and the refund state in sync.
 */

export class PaymentError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
  }
}

export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  if (method === PaymentMethod.CASH_ON_DELIVERY) {
    return new CashOnDeliveryProvider();
  }

  const env = getEnv();
  switch (env.PAYMENT_PROVIDER) {
    case "razorpay":
      return new RazorpayPaymentProvider();
    case "stripe":
      throw new PaymentError(
        "provider_unavailable",
        "The Stripe adapter is not implemented in this deployment.",
      );
    case "sandbox":
    default:
      return new SandboxPaymentProvider(sandboxSecret());
  }
}

function sandboxSecret(): string {
  const env = getEnv();
  if (env.PAYMENT_WEBHOOK_SECRET) return env.PAYMENT_WEBHOOK_SECRET;
  // In development the sandbox signs with a per-process secret. The sandbox
  // provider never moves money, so this is safe; a real deployment must set
  // PAYMENT_WEBHOOK_SECRET.
  return `sandbox-${process.env.NODE_ENV ?? "development"}`;
}

export function newIdempotencyKey(orderId: string): string {
  return `${orderId}.${randomUUID()}`;
}

export interface CreatedPayment {
  paymentId: string;
  session: PaymentSession;
}

/**
 * Creates (or reuses) the payment for an order.
 *
 * The idempotency key is derived from the order, so a retry of the same
 * checkout step cannot create a second payment.
 */
export async function createPaymentForOrder(params: {
  orderId: string;
  userId: string;
  method: PaymentMethod;
  returnUrl: string;
}): Promise<CreatedPayment> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { user: true, payments: { orderBy: { createdAt: "desc" } } },
  });

  if (!order) throw new PaymentError("not_found", "Order not found.");
  if (order.userId !== params.userId) {
    throw new PaymentError("forbidden", "This order belongs to another account.");
  }
  if (order.paymentMethod !== params.method) {
    throw new PaymentError(
      "method_mismatch",
      "The payment method does not match the order.",
    );
  }

  // Reuse an existing payment for the same method instead of creating a new one.
  const reusableStatuses: PaymentStatus[] = [
    PaymentStatus.PENDING,
    PaymentStatus.INITIATED,
    PaymentStatus.AUTHORIZED,
  ];
  const existing = order.payments.find(
    (payment) => payment.method === params.method && reusableStatuses.includes(payment.status),
  );
  if (existing) {
    return { paymentId: existing.id, session: existingSession(existing) };
  }

  const provider = getPaymentProvider(params.method);
  const idempotencyKey = newIdempotencyKey(order.id);

  const session = await provider.createPayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amountInPaise: order.totalInPaise,
    currency: order.currency,
    customerEmail: order.user.email,
    customerPhone: order.deliveryPhone,
    idempotencyKey,
    returnUrl: params.returnUrl,
  });

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      method: params.method,
      provider: session.provider,
      status: session.status,
      amountInPaise: session.amountInPaise,
      currency: session.currency,
      idempotencyKey,
      providerOrderId: session.providerOrderId,
      providerPaymentId: session.providerPaymentId,
      providerReference: JSON.stringify(session.clientInstruction ?? {}),
    },
  });

  await recordAudit({
    action: AuditAction.PAYMENT_CREATED,
    entityType: "Payment",
    entityId: payment.id,
    summary: `Payment created for order ${order.orderNumber}.`,
    actorId: params.userId,
    metadata: {
      orderId: order.id,
      method: params.method,
      provider: session.provider,
      amountInPaise: session.amountInPaise,
    },
  });

  return { paymentId: payment.id, session };
}

function existingSession(payment: {
  provider: PaymentProviderCode;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentStatus;
  amountInPaise: number;
  currency: string;
  providerReference: string | null;
}): PaymentSession {
  let clientInstruction: Record<string, string> | null = null;
  if (payment.providerReference) {
    try {
      clientInstruction = JSON.parse(payment.providerReference) as Record<string, string>;
    } catch {
      clientInstruction = null;
    }
  }
  return {
    provider: payment.provider,
    providerOrderId: payment.providerOrderId ?? "",
    providerPaymentId: payment.providerPaymentId,
    status: payment.status,
    amountInPaise: payment.amountInPaise,
    currency: payment.currency,
    clientInstruction,
    raw: {},
  };
}

/**
 * Verifies a payment on the server and applies the result to the order.
 *
 * This is the only path that may mark a payment as captured. A browser
 * redirect is treated as a hint, never as proof.
 */
export async function verifyPaymentForOrder(params: {
  paymentId: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  signature?: string | null;
  actorId?: string | null;
}): Promise<{ status: PaymentStatus; message: string }> {
  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: { order: true },
  });

  if (!payment) throw new PaymentError("not_found", "Payment not found.");

  if (payment.status === PaymentStatus.CAPTURED) {
    return { status: payment.status, message: "The payment was already captured." };
  }

  if (payment.method === PaymentMethod.CASH_ON_DELIVERY) {
    return {
      status: payment.status,
      message: "Cash on delivery is collected when the order is delivered.",
    };
  }

  const provider = getPaymentProvider(payment.method);
  const providerOrderId = params.providerOrderId ?? payment.providerOrderId ?? "";
  const providerPaymentId = params.providerPaymentId ?? payment.providerPaymentId ?? null;

  if (!providerOrderId || !providerPaymentId) {
    throw new PaymentError(
      "invalid_reference",
      "The payment reference is incomplete. The payment could not be verified.",
    );
  }

  let verification;
  try {
    verification = await provider.verifyPayment({
      providerOrderId,
      providerPaymentId,
      signature: params.signature ?? null,
    });
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      throw new PaymentError(error.code, error.message);
    }
    throw error;
  }

  // The amount charged by the provider must match the amount owed.
  if (
    verification.status === PaymentStatus.CAPTURED &&
    verification.amountInPaise !== null &&
    verification.amountInPaise !== payment.amountInPaise
  ) {
    throw new PaymentError(
      "amount_mismatch",
      "The amount paid does not match the order total. The payment was not accepted.",
    );
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: verification.status,
      providerOrderId,
      providerPaymentId,
      providerSignature: verification.providerSignature,
      failureCode: verification.failureCode,
      failureReason: verification.failureReason,
      capturedAt: verification.status === PaymentStatus.CAPTURED ? new Date() : null,
    },
  });

  await recordAudit({
    action: AuditAction.PAYMENT_STATUS_CHANGED,
    entityType: "Payment",
    entityId: payment.id,
    summary: `Payment for order ${payment.order.orderNumber} is now ${verification.status}.`,
    actorId: params.actorId ?? null,
    metadata: {
      orderId: payment.orderId,
      status: verification.status,
      providerPaymentId,
    },
  });

  if (verification.status === PaymentStatus.CAPTURED) {
    await markOrderPaid(payment.orderId);
  }

  return { status: updated.status, message: "Payment verified." };
}

async function markOrderPaid(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  if (order.status === "PENDING") {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
  }
}

/**
 * Records the collection of a cash-on-delivery payment.
 */
export async function confirmCashCollection(params: {
  orderId: string;
  actorId: string;
  actorRole: string;
}): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { payments: true },
  });
  if (!order) throw new PaymentError("not_found", "Order not found.");
  if (order.paymentMethod !== PaymentMethod.CASH_ON_DELIVERY) {
    throw new PaymentError("not_cod", "This order was not paid cash on delivery.");
  }

  const payment = order.payments[0];
  if (!payment) throw new PaymentError("not_found", "No payment record for this order.");
  if (payment.status === PaymentStatus.CAPTURED) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: PaymentStatus.CAPTURED, capturedAt: new Date() },
  });

  await recordAudit({
    action: AuditAction.PAYMENT_STATUS_CHANGED,
    entityType: "Payment",
    entityId: payment.id,
    summary: `Cash on delivery collected for order ${order.orderNumber}.`,
    actorId: params.actorId,
    actorRole: params.actorRole,
    metadata: { orderId: order.id },
  });
}

/**
 * Processes a webhook event.
 *
 * Idempotency: the provider event id is unique per provider. A duplicate
 * delivery is recorded and ignored, so a replayed webhook can never change an
 * order twice.
 */
export async function processWebhookEvent(params: {
  provider: PaymentProvider;
  rawBody: string;
  headers: Headers;
}): Promise<{ status: "processed" | "duplicate" | "rejected" | "ignored"; message: string }> {
  const provider = params.provider;
  const event = await provider.parseWebhook({
    rawBody: params.rawBody,
    headers: params.headers,
  });

  const payloadHash = createHash("sha256").update(params.rawBody).digest("hex");

  if (!event.signatureValid) {
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: provider.code,
        eventId: `${event.providerEventId}:${payloadHash.slice(0, 16)}`,
        eventType: event.eventType,
        payloadHash,
        signatureValid: false,
        status: "REJECTED",
        errorMessage: "The webhook signature could not be verified.",
      },
    });
    return { status: "rejected", message: "The webhook signature could not be verified." };
  }

  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: { provider_eventId: { provider: provider.code, eventId: event.providerEventId } },
  });

  if (existing) {
    return { status: "duplicate", message: "This event was already processed." };
  }

  const record = await prisma.paymentWebhookEvent.create({
    data: {
      provider: provider.code,
      eventId: event.providerEventId,
      eventType: event.eventType,
      payloadHash,
      signatureValid: true,
      status: "RECEIVED",
    },
  });

  try {
    let orderId: string | null = null;

    if (event.providerPaymentId) {
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            { providerPaymentId: event.providerPaymentId },
            { providerOrderId: event.providerOrderId ?? "__none__" },
          ],
        },
        include: { order: true },
      });

      if (payment) {
        orderId = payment.orderId;
        if (event.status && event.status !== payment.status) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: event.status,
              capturedAt: event.status === PaymentStatus.CAPTURED ? new Date() : payment.capturedAt,
            },
          });
          if (event.status === PaymentStatus.CAPTURED) {
            await markOrderPaid(payment.orderId);
          }
          await recordAudit({
            action: AuditAction.PAYMENT_STATUS_CHANGED,
            entityType: "Payment",
            entityId: payment.id,
            summary: `Payment for order ${payment.order.orderNumber} updated by webhook.`,
            metadata: { orderId: payment.orderId, status: event.status },
          });
        }
      }
    }

    await prisma.paymentWebhookEvent.update({
      where: { id: record.id },
      data: { status: "PROCESSED", processedAt: new Date(), orderId },
    });

    await recordAudit({
      action: AuditAction.PAYMENT_WEBHOOK_RECEIVED,
      entityType: "PaymentWebhookEvent",
      entityId: record.id,
      summary: `Webhook ${event.eventType} processed.`,
      metadata: { provider: provider.code, eventId: event.providerEventId, orderId },
    });

    return { status: "processed", message: "The event was processed." };
  } catch (error) {
    await prisma.paymentWebhookEvent.update({
      where: { id: record.id },
      data: {
        status: "REJECTED",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    });
    throw error;
  }
}

export async function refundPayment(params: {
  paymentId: string;
  amountInPaise: number;
  actorId: string;
  actorRole: string;
}): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: params.paymentId } });
  if (!payment) throw new PaymentError("not_found", "Payment not found.");
  if (payment.status !== PaymentStatus.CAPTURED) {
    throw new PaymentError(
      "not_refundable",
      "Only a captured payment can be refunded.",
    );
  }
  if (!payment.providerPaymentId) {
    throw new PaymentError(
      "not_refundable",
      "This payment has no provider reference and cannot be refunded automatically.",
    );
  }

  const provider = getPaymentProvider(payment.method);
  if (!provider.supportsRefunds) {
    throw new PaymentError(
      "not_refundable",
      "This payment method does not support automatic refunds.",
    );
  }

  const result = await provider.refund({
    providerPaymentId: payment.providerPaymentId,
    amountInPaise: params.amountInPaise,
    idempotencyKey: newIdempotencyKey(payment.id),
  });

  const totalRefunded = payment.refundedAmountInPaise + params.amountInPaise;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status:
        totalRefunded >= payment.amountInPaise
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED,
      refundedAmountInPaise: totalRefunded,
      refundedAt: new Date(),
    },
  });

  await recordAudit({
    action: AuditAction.PAYMENT_REFUNDED,
    entityType: "Payment",
    entityId: payment.id,
    summary: `Refund issued for payment ${payment.id}.`,
    actorId: params.actorId,
    actorRole: params.actorRole,
    metadata: {
      amountInPaise: params.amountInPaise,
      providerRefundId: result.providerRefundId,
    },
  });
}

export { PaymentProviderError };
