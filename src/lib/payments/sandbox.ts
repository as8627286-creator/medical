import "server-only";
import { createHmac } from "node:crypto";
import { PaymentProviderCode, PaymentStatus } from "@/generated/prisma/enums";
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
 * Deterministic sandbox payment provider.
 *
 * It behaves like a real gateway from the application's point of view:
 *  - a payment session is created on the server,
 *  - the browser gets a signed token that it hands back,
 *  - the server verifies the token and the amount before marking the payment
 *    as captured,
 *  - webhooks are HMAC signed and rejected when the signature is invalid,
 *  - the same idempotency key always returns the same session.
 *
 * No money moves and no external service is contacted. This is the default
 * provider in every non-production configuration.
 */

const SIGNATURE_PREFIX = "sandbox";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export class SandboxPaymentProvider implements PaymentProvider {
  readonly code = PaymentProviderCode.SANDBOX;
  readonly live = false;
  readonly supportsRefunds = true;

  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentSession> {
    const providerOrderId = buildProviderOrderId(input.amountInPaise, input.currency, input.idempotencyKey);
    const providerPaymentId = `sbx_pay_${input.idempotencyKey}`;
    const token = sign(
      `${providerOrderId}|${providerPaymentId}|${input.amountInPaise}|${input.currency}`,
      this.secret,
    );

    return {
      provider: this.code,
      providerOrderId,
      providerPaymentId,
      status: PaymentStatus.INITIATED,
      amountInPaise: input.amountInPaise,
      currency: input.currency,
      clientInstruction: {
        paymentId: providerPaymentId,
        orderId: providerOrderId,
        amount: String(input.amountInPaise),
        currency: input.currency,
        signature: token,
        returnUrl: input.returnUrl,
      },
      raw: { sandbox: true, idempotencyKey: input.idempotencyKey },
    };
  }

  async verifyPayment(input: {
    providerOrderId: string;
    providerPaymentId: string | null;
    signature?: string | null;
  }): Promise<PaymentVerification> {
    if (!input.providerOrderId || !input.providerPaymentId) {
      throw new PaymentProviderError(
        "invalid_reference",
        "The payment reference is incomplete.",
      );
    }

    const expectedAmount = this.amountFromOrderId(input.providerOrderId);
    const expectedCurrency = this.currencyFromOrderId(input.providerOrderId);
    const token = sign(
      `${input.providerOrderId}|${input.providerPaymentId}|${expectedAmount}|${expectedCurrency}`,
      this.secret,
    );

    if (!input.signature || !safeEqual(input.signature, token)) {
      return {
        status: PaymentStatus.FAILED,
        providerPaymentId: input.providerPaymentId,
        providerOrderId: input.providerOrderId,
        providerSignature: input.signature ?? null,
        amountInPaise: expectedAmount,
        currency: "INR",
        failureCode: "signature_mismatch",
        failureReason: "The payment signature did not match.",
        raw: { sandbox: true },
      };
    }

    return {
      status: PaymentStatus.CAPTURED,
      providerPaymentId: input.providerPaymentId,
      providerOrderId: input.providerOrderId,
      providerSignature: input.signature,
      amountInPaise: expectedAmount,
      currency: expectedCurrency,
      failureCode: null,
      failureReason: null,
      raw: { sandbox: true },
    };
  }

  async parseWebhook(input: { rawBody: string; headers: Headers }): Promise<WebhookEvent> {
    const signature = input.headers.get("x-sandbox-signature") ?? "";
    const expected = sign(input.rawBody, this.secret);
    const signatureValid = safeEqual(signature, expected);

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(input.rawBody) as Record<string, unknown>;
    } catch {
      return {
        providerEventId: "invalid",
        eventType: "unknown",
        providerOrderId: null,
        providerPaymentId: null,
        status: null,
        amountInPaise: null,
        currency: null,
        signatureValid: false,
        raw: {},
      };
    }

    const payment = payload.payment as Record<string, unknown> | undefined;

    return {
      providerEventId: String(payload.id ?? `${Date.now()}`),
      eventType: String(payload.type ?? "unknown"),
      providerOrderId: payment ? String(payment.order_id ?? "") : null,
      providerPaymentId: payment ? String(payment.id ?? "") : null,
      status: payment ? mapSandboxStatus(String(payment.status ?? "")) : null,
      amountInPaise: payment?.amount ? Number(payment.amount) : null,
      currency: payment?.currency ? String(payment.currency) : null,
      signatureValid,
      raw: payload,
    };
  }

  async refund(input: {
    providerPaymentId: string;
    amountInPaise: number;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    return {
      status: PaymentStatus.REFUNDED,
      providerRefundId: `sbx_refund_${input.idempotencyKey}`,
      amountInPaise: input.amountInPaise,
      raw: { sandbox: true },
    };
  }

  /**
   * The sandbox encodes the amount and currency in the provider order id so
   * that the verification path can check them without a database lookup. The
   * application still compares the amount with the order it owns.
   */
  private amountFromOrderId(providerOrderId: string): number {
    const amount = Number(parseProviderOrderId(providerOrderId).amount);
    if (!Number.isFinite(amount)) {
      throw new PaymentProviderError("invalid_reference", "Unknown sandbox payment reference.");
    }
    return amount;
  }

  private currencyFromOrderId(providerOrderId: string): string {
    return parseProviderOrderId(providerOrderId).currency;
  }
}

/**
 * Provider order id layout: `sbx_order_<amount>.<currency>.<idempotencyKey>`.
 * The idempotency key is a UUID and therefore contains no dots.
 */
function buildProviderOrderId(
  amountInPaise: number,
  currency: string,
  idempotencyKey: string,
): string {
  return `sbx_order_${amountInPaise}.${currency}.${idempotencyKey}`;
}

function parseProviderOrderId(providerOrderId: string): {
  amount: string;
  currency: string;
  idempotencyKey: string;
} {
  const [head, currency, idempotencyKey] = providerOrderId.split(".");
  const amount = head?.startsWith("sbx_order_") ? head.slice("sbx_order_".length) : "";
  return { amount, currency: currency ?? "INR", idempotencyKey: idempotencyKey ?? "" };
}

/** Maps a provider status onto the application's payment status. */
function mapSandboxStatus(status: string): PaymentStatus | null {
  switch (status.toLowerCase()) {
    case "captured":
      return PaymentStatus.CAPTURED;
    case "authorized":
      return PaymentStatus.AUTHORIZED;
    case "failed":
      return PaymentStatus.FAILED;
    case "cancelled":
      return PaymentStatus.CANCELLED;
    case "refunded":
      return PaymentStatus.REFUNDED;
    case "initiated":
      return PaymentStatus.INITIATED;
    default:
      return null;
  }
}

export { SIGNATURE_PREFIX };
