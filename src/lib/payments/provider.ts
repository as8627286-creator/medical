import "server-only";
import { PaymentProviderCode, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Payment provider abstraction.
 *
 * The rest of the application never talks to a gateway directly: it calls this
 * interface. Gateway credentials live in the environment and are only read by
 * the adapter, so a provider can be added or replaced without touching the
 * order, checkout or webhook code.
 *
 * Every adapter must be safe in sandbox mode: the default configuration never
 * moves real money.
 */

export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  amountInPaise: number;
  currency: string;
  customerEmail: string;
  customerPhone: string;
  /** Server-generated key that makes the request idempotent. */
  idempotencyKey: string;
  /** Where the customer is sent back to after paying. */
  returnUrl: string;
}

export interface PaymentSession {
  provider: PaymentProviderCode;
  /** Identifier of the order at the provider. */
  providerOrderId: string;
  /** Identifier of the payment attempt, when the provider creates one. */
  providerPaymentId: string | null;
  status: PaymentStatus;
  amountInPaise: number;
  currency: string;
  /** Data the browser needs to complete the payment, if any. */
  clientInstruction: Record<string, string> | null;
  raw: Record<string, unknown>;
}

export interface PaymentVerification {
  status: PaymentStatus;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  providerSignature: string | null;
  amountInPaise: number | null;
  currency: string | null;
  failureCode: string | null;
  failureReason: string | null;
  raw: Record<string, unknown>;
}

export interface WebhookEvent {
  providerEventId: string;
  eventType: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentStatus | null;
  amountInPaise: number | null;
  currency: string | null;
  signatureValid: boolean;
  raw: Record<string, unknown>;
}

export interface RefundResult {
  status: PaymentStatus;
  providerRefundId: string | null;
  amountInPaise: number;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly code: PaymentProviderCode;
  readonly live: boolean;
  readonly supportsRefunds: boolean;

  createPayment(input: CreatePaymentInput): Promise<PaymentSession>;
  /**
   * Server-side verification of a payment. The result of this call - not the
   * browser - is the only accepted proof that money was paid.
   */
  verifyPayment(input: {
    providerOrderId: string;
    providerPaymentId: string | null;
    signature?: string | null;
  }): Promise<PaymentVerification>;
  /** Parses and authenticates a webhook payload. */
  parseWebhook(input: { rawBody: string; headers: Headers }): Promise<WebhookEvent>;
  refund(input: {
    providerPaymentId: string;
    amountInPaise: number;
    idempotencyKey: string;
  }): Promise<RefundResult>;
}

export class PaymentProviderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PaymentProviderError";
    this.code = code;
  }
}
