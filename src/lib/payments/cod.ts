import "server-only";
import { PaymentProviderCode, PaymentStatus } from "@/generated/prisma/enums";
import {
  type CreatePaymentInput,
  type PaymentProvider,
  type PaymentSession,
  type PaymentVerification,
  type RefundResult,
  type WebhookEvent,
} from "./provider";

/**
 * Cash on delivery.
 *
 * There is no external provider: the payment stays `PENDING` until staff
 * confirm that the money was collected at the door. The order can only be
 * marked as delivered once the collection has been recorded.
 */
export class CashOnDeliveryProvider implements PaymentProvider {
  readonly code = PaymentProviderCode.CASH_ON_DELIVERY;
  readonly live = false;
  readonly supportsRefunds = false;

  async createPayment(input: CreatePaymentInput): Promise<PaymentSession> {
    return {
      provider: this.code,
      providerOrderId: `cod_${input.idempotencyKey}`,
      providerPaymentId: null,
      status: PaymentStatus.PENDING,
      amountInPaise: input.amountInPaise,
      currency: input.currency,
      clientInstruction: null,
      raw: { method: "cash_on_delivery" },
    };
  }

  async verifyPayment(): Promise<PaymentVerification> {
    return {
      status: PaymentStatus.PENDING,
      providerPaymentId: null,
      providerOrderId: null,
      providerSignature: null,
      amountInPaise: null,
      currency: null,
      failureCode: null,
      failureReason: null,
      raw: {},
    };
  }

  async parseWebhook(): Promise<WebhookEvent> {
    return {
      providerEventId: "cod",
      eventType: "not_applicable",
      providerOrderId: null,
      providerPaymentId: null,
      status: null,
      amountInPaise: null,
      currency: null,
      signatureValid: false,
      raw: {},
    };
  }

  async refund(): Promise<RefundResult> {
    return {
      status: PaymentStatus.REFUNDED,
      providerRefundId: null,
      amountInPaise: 0,
      raw: { note: "Cash on delivery has no provider-side refund; record it manually." },
    };
  }
}
