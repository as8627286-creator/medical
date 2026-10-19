import { getPaymentProvider, processWebhookEvent } from "@/lib/payments/service";
import { PaymentMethod } from "@/generated/prisma/enums";
import { jsonError } from "@/lib/security";

/**
 * Payment webhook endpoint.
 *
 * The payload is read as raw text so that the signature can be verified
 * against the exact bytes the provider sent. The handler is idempotent: the
 * provider event id is unique, so a replayed delivery is recorded and ignored.
 */

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/webhooks/payment/[provider]">,
) {
  const { provider } = await ctx.params;

  const rawBody = await request.text();

  if (provider === "cash-on-delivery") {
    return jsonError(400, "unsupported", "Cash on delivery has no webhook endpoint.");
  }

  const method =
    provider === "sandbox"
      ? PaymentMethod.ONLINE
      : provider === "razorpay"
        ? PaymentMethod.ONLINE
        : null;

  if (!method) {
    return jsonError(404, "unknown_provider", "Unknown payment provider.");
  }

  let paymentProvider;
  try {
    paymentProvider = getPaymentProvider(method);
  } catch {
    return jsonError(503, "provider_unavailable", "The payment provider is not configured.");
  }

  try {
    const result = await processWebhookEvent({
      provider: paymentProvider,
      rawBody,
      headers: request.headers,
    });

    switch (result.status) {
      case "processed":
        return Response.json({ ok: true, status: result.status });
      case "duplicate":
        return Response.json({ ok: true, status: result.status });
      case "ignored":
        return Response.json({ ok: true, status: result.status });
      case "rejected":
      default:
        return jsonError(400, "rejected", result.message);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "webhook.failed",
        provider,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return jsonError(500, "processing_failed", "The webhook could not be processed.");
  }
}
