import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentProviderCode, PaymentStatus } from "@/generated/prisma/enums";
import { getEnv } from "@/lib/env";
import {
  PaymentProviderError,
  type CreatePaymentInput,
  type PaymentProvider,
  type PaymentSession,
  type PaymentVerification,
  type RefundResult,
  type WebhookEvent,
} from "./provider";

/**
 * Razorpay adapter.
 *
 * IMPORTANT: this adapter is inert unless the environment provides Razorpay
 * credentials *and* `PAYMENT_LIVE=true`. Merchant approval for a pharmacy
 * (and the local legal position on online medicine sales) must be confirmed
 * before it is enabled. See docs/PHARMACY_COMPLIANCE_CHECKLIST.md.
 *
 * The implementation follows Razorpay's documented flow:
 *  - orders are created server-side,
 *  - the checkout uses the payment id and the checkout.js script,
 *  - the payment is verified server-side with the HMAC of
 *    `order_id|payment_id`,
 *  - webhooks are authenticated with the HMAC of the raw body.
 */

const RAZORPAY_API = "https://api.razorpay.com";

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly code = PaymentProviderCode.RAZORPAY;
  readonly live: boolean;
  readonly supportsRefunds = true;

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor() {
    const env = getEnv();
    if (!env.PAYMENT_RAZORPAY_KEY_ID || !env.PAYMENT_RAZORPAY_KEY_SECRET) {
      throw new PaymentProviderError(
        "not_configured",
        "Razorpay credentials are not configured.",
      );
    }
    this.keyId = env.PAYMENT_RAZORPAY_KEY_ID;
    this.keySecret = env.PAYMENT_RAZORPAY_KEY_SECRET;
    this.webhookSecret = env.PAYMENT_RAZORPAY_WEBHOOK_SECRET ?? env.PAYMENT_WEBHOOK_SECRET ?? "";
    this.live = env.PAYMENT_LIVE;
  }

  private async request(
    path: string,
    method: "POST" | "GET",
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    const response = await fetch(`${RAZORPAY_API}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      const description =
        typeof payload.description === "string" ? payload.description : response.statusText;
      throw new PaymentProviderError("provider_error", `Razorpay error: ${description}`);
    }

    return payload;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentSession> {
    const payload = await this.request("/v1/orders", "POST", {
      amount: input.amountInPaise,
      currency: input.currency,
      receipt: input.orderNumber,
      notes: { orderId: input.orderId, idempotencyKey: input.idempotencyKey },
    });

    const providerOrderId = String(payload.id ?? "");
    const providerPaymentId = payload.payment_id ? String(payload.payment_id) : null;

    return {
      provider: this.code,
      providerOrderId,
      providerPaymentId,
      status: PaymentStatus.INITIATED,
      amountInPaise: input.amountInPaise,
      currency: input.currency,
      clientInstruction: {
        key: this.keyId,
        orderId: providerOrderId,
        amount: String(input.amountInPaise),
        currency: input.currency,
        name: input.orderNumber,
        returnUrl: input.returnUrl,
      },
      raw: payload,
    };
  }

  async verifyPayment(input: {
    providerOrderId: string;
    providerPaymentId: string | null;
    signature?: string | null;
  }): Promise<PaymentVerification> {
    if (!input.providerPaymentId) {
      throw new PaymentProviderError(
        "invalid_reference",
        "A payment id is required to verify the payment.",
      );
    }

    const payload = await this.request(
      `/v1/payments/${encodeURIComponent(input.providerPaymentId)}`,
      "GET",
    );

    const expectedSignature = createHmac("sha256", this.keySecret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest("hex");

    const signatureValid = input.signature
      ? safeEqual(input.signature, expectedSignature)
      : false;

    const status = String(payload.status ?? "").toLowerCase();
    const mappedStatus =
      status === "captured"
        ? PaymentStatus.CAPTURED
        : status === "authorized"
          ? PaymentStatus.AUTHORIZED
          : status === "failed"
            ? PaymentStatus.FAILED
            : PaymentStatus.INITIATED;

    if (input.signature && !signatureValid) {
      return {
        status: PaymentStatus.FAILED,
        providerPaymentId: input.providerPaymentId,
        providerOrderId: input.providerOrderId,
        providerSignature: input.signature,
        amountInPaise: typeof payload.amount === "number" ? payload.amount : null,
        currency: typeof payload.currency === "string" ? payload.currency : null,
        failureCode: "signature_mismatch",
        failureReason: "The payment signature did not match.",
        raw: payload,
      };
    }

    return {
      status: mappedStatus,
      providerPaymentId: input.providerPaymentId,
      providerOrderId: String(payload.order_id ?? input.providerOrderId),
      providerSignature: input.signature ?? null,
      amountInPaise: typeof payload.amount === "number" ? payload.amount : null,
      currency: typeof payload.currency === "string" ? payload.currency : null,
      failureCode:
        typeof payload.error_code === "string" ? payload.error_code : null,
      failureReason:
        typeof payload.error_description === "string" ? payload.error_description : null,
      raw: payload,
    };
  }

  async parseWebhook(input: { rawBody: string; headers: Headers }): Promise<WebhookEvent> {
    const signature = input.headers.get("x-razorpay-signature") ?? "";
    const expected = createHmac("sha256", this.webhookSecret)
      .update(input.rawBody)
      .digest("hex");
    const signatureValid = this.webhookSecret.length > 0 && safeEqual(signature, expected);

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(input.rawBody) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    const payment = (payload.payment ?? {}) as Record<string, unknown>;
    const entity = (payload.payload ?? {}) as Record<string, unknown>;
    const entityPayment = (entity.payment ?? {}) as Record<string, unknown>;

    const status = String(entityPayment.status ?? payment.status ?? "").toLowerCase();
    const mappedStatus =
      status === "captured"
        ? PaymentStatus.CAPTURED
        : status === "authorized"
          ? PaymentStatus.AUTHORIZED
          : status === "failed"
            ? PaymentStatus.FAILED
            : status === "refunded"
              ? PaymentStatus.REFUNDED
              : null;

    return {
      providerEventId: String(payload.event ?? `${Date.now()}`),
      eventType: String(payload.event ?? "unknown"),
      providerOrderId: entityPayment.order_id
        ? String(entityPayment.order_id)
        : payment.order_id
          ? String(payment.order_id)
          : null,
      providerPaymentId: entityPayment.id ? String(entityPayment.id) : null,
      status: mappedStatus,
      amountInPaise:
        typeof entityPayment.amount === "number" ? entityPayment.amount : null,
      currency:
        typeof entityPayment.currency === "string" ? entityPayment.currency : null,
      signatureValid,
      raw: payload,
    };
  }

  async refund(input: {
    providerPaymentId: string;
    amountInPaise: number;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    const payload = await this.request(
      `/v1/payments/${encodeURIComponent(input.providerPaymentId)}/refund`,
      "POST",
      { amount: input.amountInPaise, speed: "normal" },
    );

    return {
      status: PaymentStatus.REFUNDED,
      providerRefundId: payload.id ? String(payload.id) : null,
      amountInPaise: input.amountInPaise,
      raw: payload,
    };
  }
}
