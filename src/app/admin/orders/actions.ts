"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { AuditAction, DeliveryStatus, OrderStatus } from "@/generated/prisma/enums";
import {
  deliveryUpdateSchema,
  orderCancelSchema,
  orderStatusChangeSchema,
  canTransitionOrder,
} from "@/lib/validation/commerce";
import { fieldErrors } from "@/lib/validation/common";
import { formValue } from "@/lib/validation/form";
import { getClientIp, getUserAgent } from "@/lib/security";
import { orderIsClearedForDispatch, expireStalePrescriptions } from "@/lib/prescriptions/service";
import { confirmCashCollection } from "@/lib/payments/service";
import { cancelOrder, OrderError } from "@/lib/orders/service";

export type AdminOrderState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

async function requestContext() {
  const requestHeaders = await headers();
  return {
    ipAddress: getClientIp(requestHeaders),
    userAgent: getUserAgent(requestHeaders),
  };
}

/**
 * Changes the status of an order.
 *
 * Only the transitions defined in the state machine are allowed, and an order
 * that needs a prescription review cannot be dispatched before every
 * prescription requirement is approved.
 */
export async function changeOrderStatusAction(
  _prevState: AdminOrderState,
  formData: FormData,
): Promise<AdminOrderState> {
  const actor = await authorize(PERMISSIONS.ORDER_WRITE);

  const parsed = orderStatusChangeSchema.safeParse({
    orderId: formValue(formData, "orderId"),
    status: formValue(formData, "status"),
    note: formValue(formData, "note"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed) };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { delivery: true },
  });
  if (!order) {
    return { errors: { orderId: "Order not found." } };
  }

  const target = parsed.data.status as OrderStatus;

  if (!canTransitionOrder(order.status, target)) {
    return {
      errors: {
        status: `An order that is ${order.status.toLowerCase().replace(/_/g, " ")} cannot be moved to ${target.toLowerCase().replace(/_/g, " ")}.`,
      },
    };
  }

  // A prescription-required order must not be prepared or dispatched before
  // the review is complete.
  const dispatchBlocked: OrderStatus[] = [
    OrderStatus.PREPARING,
    OrderStatus.DISPATCHED,
    OrderStatus.OUT_FOR_DELIVERY,
  ];
  if (dispatchBlocked.includes(target) && order.requiresPrescription) {
    const cleared = await orderIsClearedForDispatch(order.id);
    if (!cleared) {
      return {
        errors: {
          status:
            "This order needs an approved prescription before it can be prepared or dispatched.",
        },
      };
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: target,
        ...(target === OrderStatus.CONFIRMED ? { confirmedAt: now } : {}),
        ...(target === OrderStatus.PREPARING ? { preparedAt: now } : {}),
        ...(target === OrderStatus.DISPATCHED ? { dispatchedAt: now } : {}),
        ...(target === OrderStatus.OUT_FOR_DELIVERY ? { outForDeliveryAt: now } : {}),
        ...(target === OrderStatus.DELIVERED ? { deliveredAt: now } : {}),
        ...(target === OrderStatus.FAILED_DELIVERY
          ? { failureReason: parsed.data.note ?? null }
          : {}),
      },
    });

    // Keep the delivery record in step with the order.
    if (order.delivery) {
      const deliveryStatus = mapDeliveryStatus(target);
      if (deliveryStatus) {
        await tx.deliveryRecord.update({
          where: { orderId: order.id },
          data: {
            status: deliveryStatus,
            ...(deliveryStatus === DeliveryStatus.DELIVERED ? { deliveredAt: now } : {}),
            ...(deliveryStatus === DeliveryStatus.OUT_FOR_DELIVERY
              ? { outForDeliveryAt: now }
              : {}),
          },
        });
      }
    } else {
      const createFor: OrderStatus[] = [OrderStatus.PREPARING, OrderStatus.DISPATCHED];
      if (createFor.includes(target)) {
        await tx.deliveryRecord.create({
          data: {
            orderId: order.id,
            status: mapDeliveryStatus(target) ?? DeliveryStatus.PENDING,
          },
        });
      }
    }
  });

  // Cash on delivery is collected when the order is delivered.
  if (target === OrderStatus.DELIVERED && order.paymentMethod === "CASH_ON_DELIVERY") {
    await confirmCashCollection({
      orderId: order.id,
      actorId: actor.id,
      actorRole: actor.role.code,
    });
  }

  const context = await requestContext();
  await recordAudit({
    action: AuditAction.ORDER_STATUS_CHANGED,
    entityType: "Order",
    entityId: order.id,
    summary: `Order ${order.orderNumber} moved from ${order.status} to ${target}.`,
    actorId: actor.id,
    actorRole: actor.role.code,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: { from: order.status, to: target, note: parsed.data.note ?? null },
  });

  revalidatePath(`/admin/orders/${order.orderNumber}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${order.orderNumber}`);
  revalidatePath("/orders");

  return { ok: true, message: `Order moved to ${target.toLowerCase().replace(/_/g, " ")}.` };
}

function mapDeliveryStatus(status: OrderStatus): DeliveryStatus | null {
  switch (status) {
    case OrderStatus.PREPARING:
      return DeliveryStatus.PREPARING;
    case OrderStatus.DISPATCHED:
      return DeliveryStatus.DISPATCHED;
    case OrderStatus.OUT_FOR_DELIVERY:
      return DeliveryStatus.OUT_FOR_DELIVERY;
    case OrderStatus.DELIVERED:
      return DeliveryStatus.DELIVERED;
    case OrderStatus.FAILED_DELIVERY:
      return DeliveryStatus.FAILED;
    default:
      return null;
  }
}

export async function cancelOrderAction(
  _prevState: AdminOrderState,
  formData: FormData,
): Promise<AdminOrderState> {
  const actor = await authorize(PERMISSIONS.ORDER_CANCEL);

  const parsed = orderCancelSchema.safeParse({
    orderId: formValue(formData, "orderId"),
    reason: formValue(formData, "reason"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed) };
  }

  try {
    await cancelOrder({
      orderId: parsed.data.orderId,
      reason: parsed.data.reason,
      actorId: actor.id,
      actorRole: actor.role.code,
      cancelledBy: "STAFF",
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return { errors: { reason: error.message } };
    }
    throw error;
  }

  const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
  revalidatePath("/admin/orders");
  if (order) {
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    revalidatePath(`/orders/${order.orderNumber}`);
  }

  return { ok: true, message: "Order cancelled." };
}

/** Updates the delivery record of an order. */
export async function updateDeliveryAction(
  _prevState: AdminOrderState,
  formData: FormData,
): Promise<AdminOrderState> {
  const actor = await authorize(PERMISSIONS.DELIVERY_WRITE);

  const parsed = deliveryUpdateSchema.safeParse({
    orderId: formValue(formData, "orderId"),
    status: formValue(formData, "status"),
    note: formValue(formData, "note"),
    deliveredToName: formValue(formData, "deliveredToName"),
    proofOfDeliveryNote: formValue(formData, "proofOfDeliveryNote"),
    failureReason: formValue(formData, "failureReason"),
    assignedTo: formValue(formData, "assignedTo"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed) };
  }

  const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
  if (!order) {
    return { errors: { orderId: "Order not found." } };
  }

  const status = parsed.data.status as DeliveryStatus;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.deliveryRecord.upsert({
      where: { orderId: order.id },
      update: {
        status,
        notes: parsed.data.note ?? null,
        deliveredToName: parsed.data.deliveredToName ?? null,
        proofOfDeliveryNote: parsed.data.proofOfDeliveryNote ?? null,
        failureReason: parsed.data.failureReason ?? null,
        assignedTo: parsed.data.assignedTo ?? null,
        outForDeliveryAt:
          status === DeliveryStatus.OUT_FOR_DELIVERY ? now : undefined,
        deliveredAt: status === DeliveryStatus.DELIVERED ? now : undefined,
      },
      create: {
        orderId: order.id,
        status,
        notes: parsed.data.note ?? null,
        deliveredToName: parsed.data.deliveredToName ?? null,
        proofOfDeliveryNote: parsed.data.proofOfDeliveryNote ?? null,
        failureReason: parsed.data.failureReason ?? null,
        assignedTo: parsed.data.assignedTo ?? null,
        outForDeliveryAt: status === DeliveryStatus.OUT_FOR_DELIVERY ? now : null,
        deliveredAt: status === DeliveryStatus.DELIVERED ? now : null,
      },
    });

    // Keep the order status aligned with the delivery status.
    const orderStatus = mapOrderStatus(status);
    if (orderStatus && orderStatus !== order.status) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: orderStatus,
          ...(orderStatus === OrderStatus.DELIVERED ? { deliveredAt: now } : {}),
          ...(orderStatus === OrderStatus.OUT_FOR_DELIVERY ? { outForDeliveryAt: now } : {}),
          ...(orderStatus === OrderStatus.FAILED_DELIVERY
            ? { failureReason: parsed.data.failureReason ?? null }
            : {}),
        },
      });
    }
  });

  if (status === DeliveryStatus.DELIVERED && order.paymentMethod === "CASH_ON_DELIVERY") {
    await confirmCashCollection({
      orderId: order.id,
      actorId: actor.id,
      actorRole: actor.role.code,
    });
  }

  const context = await requestContext();
  await recordAudit({
    action: AuditAction.DELIVERY_STATUS_CHANGED,
    entityType: "Order",
    entityId: order.id,
    summary: `Delivery for order ${order.orderNumber} moved to ${status}.`,
    actorId: actor.id,
    actorRole: actor.role.code,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: { status, note: parsed.data.note ?? null },
  });

  revalidatePath(`/admin/orders/${order.orderNumber}`);
  revalidatePath(`/orders/${order.orderNumber}`);

  return { ok: true, message: "Delivery updated." };
}

function mapOrderStatus(status: DeliveryStatus): OrderStatus | null {
  switch (status) {
    case DeliveryStatus.PREPARING:
      return OrderStatus.PREPARING;
    case DeliveryStatus.DISPATCHED:
      return OrderStatus.DISPATCHED;
    case DeliveryStatus.OUT_FOR_DELIVERY:
      return OrderStatus.OUT_FOR_DELIVERY;
    case DeliveryStatus.DELIVERED:
      return OrderStatus.DELIVERED;
    case DeliveryStatus.FAILED:
      return OrderStatus.FAILED_DELIVERY;
    default:
      return null;
  }
}

/** Marks prescriptions that are past their validity window as expired. */
export async function runPrescriptionExpiryAction(): Promise<void> {
  await authorize(PERMISSIONS.PRESCRIPTION_REVIEW);
  const expired = await expireStalePrescriptions();
  await recordAudit({
    action: AuditAction.PRESCRIPTION_REVIEWED,
    entityType: "PrescriptionRequirement",
    summary: `${expired} prescription(s) marked as expired.`,
  });
  revalidatePath("/admin/prescriptions");
}
