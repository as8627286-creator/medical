"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { addressSchema } from "@/lib/validation/commerce";
import { fieldErrors } from "@/lib/validation/common";
import { formCheckbox, formValue } from "@/lib/validation/form";
import { quoteDelivery } from "@/lib/delivery/zones";
import { placeOrder, OrderError } from "@/lib/orders/service";
import { createPaymentForOrder, PaymentError } from "@/lib/payments/service";
import { PaymentMethod } from "@/generated/prisma/enums";

export type CheckoutState = {
  errors?: Record<string, string>;
  message?: string;
  orderNumber?: string;
};

/** Saves a delivery address for the signed-in customer. */
export async function saveAddressAction(
  _prevState: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=%2Fcheckout");
  }

  const parsed = addressSchema.safeParse({
    label: formValue(formData, "label"),
    fullName: formValue(formData, "fullName"),
    phone: formValue(formData, "phone"),
    line1: formValue(formData, "line1"),
    line2: formValue(formData, "line2"),
    landmark: formValue(formData, "landmark"),
    city: formValue(formData, "city"),
    state: formValue(formData, "state"),
    pincode: formValue(formData, "pincode"),
    isDefault: formCheckbox(formData, "isDefault"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed) };
  }

  const quote = await quoteDelivery(parsed.data.pincode);
  if (!quote.serviceable) {
    return {
      errors: {
        pincode:
          quote.reason ?? "We do not deliver to this PIN code yet. Please check the PIN code.",
      },
    };
  }

  const isDefault = parsed.data.isDefault ?? false;

  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }
    await tx.address.create({
      data: {
        userId: user.id,
        label: parsed.data.label ?? null,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        line1: parsed.data.line1,
        line2: parsed.data.line2 ?? null,
        landmark: parsed.data.landmark ?? null,
        city: parsed.data.city,
        state: parsed.data.state,
        pincode: parsed.data.pincode,
        isDefault,
      },
    });
  });

  revalidatePath("/checkout");
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." } as CheckoutState;
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const id = formValue(formData, "id");
  await prisma.address.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/checkout");
  revalidatePath("/account/addresses");
}

/**
 * Places the order.
 *
 * The cart is re-priced on the server, stock is reserved inside the same
 * transaction, and the payment is created by the server. The browser never
 * sends a total.
 */
export async function placeOrderAction(
  _prevState: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=%2Fcheckout");
  }

  const addressId = formValue(formData, "addressId");
  const paymentMethod = formValue(formData, "paymentMethod");
  const customerNote = formValue(formData, "customerNote");

  if (paymentMethod !== PaymentMethod.CASH_ON_DELIVERY && paymentMethod !== PaymentMethod.ONLINE) {
    return { errors: { paymentMethod: "Choose a payment method." } };
  }

  if (paymentMethod === PaymentMethod.ONLINE) {
    const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    if (!settings?.livePaymentsEnabled) {
      return {
        errors: {
          paymentMethod: "Online payment is not available at the moment.",
        },
      };
    }
  }

  try {
    const placed = await placeOrder({
      userId: user.id,
      addressId,
      paymentMethod: paymentMethod as PaymentMethod,
      customerNote: customerNote || null,
    });

    if (paymentMethod === PaymentMethod.ONLINE) {
      const requestHeaders = await headers();
      const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
      const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
      await createPaymentForOrder({
        orderId: placed.orderId,
        userId: user.id,
        method: PaymentMethod.ONLINE,
        returnUrl: `${protocol}://${host}/orders/${placed.orderNumber}?payment=return`,
      });
    }

    revalidatePath("/cart");
    revalidatePath("/orders");
    redirect(`/orders/${placed.orderNumber}?placed=1`);
  } catch (error) {
    if (error instanceof OrderError) {
      return { errors: { addressId: error.message } };
    }
    if (error instanceof PaymentError) {
      return { errors: { paymentMethod: error.message } };
    }
    throw error;
  }
}

/** Cancels an order placed by the customer. */
export async function cancelOrderAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const orderId = formValue(formData, "orderId");
  const reason = formValue(formData, "reason") || "Cancelled by the customer.";

  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id } });
  if (!order) return;

  const { cancelOrder } = await import("@/lib/orders/service");
  await cancelOrder({
    orderId: order.id,
    reason,
    actorId: user.id,
    actorRole: "CUSTOMER",
    cancelledBy: "CUSTOMER",
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.orderNumber}`);
}

/**
 * Server-side verification of a payment after the customer returns from the
 * gateway. The browser's claim is only a hint.
 */
export async function verifyPaymentAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const orderId = formValue(formData, "orderId");
  const providerOrderId = formValue(formData, "providerOrderId");
  const providerPaymentId = formValue(formData, "providerPaymentId");
  const signature = formValue(formData, "signature");

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) return;

  const payment = order.payments[0];
  if (!payment) return;

  const { verifyPaymentForOrder } = await import("@/lib/payments/service");
  await verifyPaymentForOrder({
    paymentId: payment.id,
    providerOrderId: providerOrderId || payment.providerOrderId,
    providerPaymentId: providerPaymentId || payment.providerPaymentId,
    signature: signature || null,
    actorId: user.id,
  });

  revalidatePath(`/orders/${order.orderNumber}`);
}

