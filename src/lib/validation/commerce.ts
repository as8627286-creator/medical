import { z } from "zod";
import { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";
import {
  emailSchema,
  nameSchema,
  phoneSchema,
  pincodeSchema,
  quantitySchema,
} from "./common";
import { requiredNumber } from "./form";

/**
 * Storefront input schemas: cart, checkout, addresses, order transitions.
 */

export const cartItemSchema = z.object({
  productId: z.string().uuid("Invalid product"),
  quantity: quantitySchema,
});

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  fullName: nameSchema,
  phone: phoneSchema,
  line1: z.string().trim().min(4, "Enter the address").max(200),
  line2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "Enter the city").max(80),
  state: z.string().trim().min(2, "Enter the state").max(80),
  pincode: pincodeSchema,
  isDefault: z.coerce.boolean().optional(),
});

export const checkoutSchema = z.object({
  addressId: z.string().uuid("Select a delivery address"),
  paymentMethod: z.enum(
    Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]],
    { message: "Select a payment method" },
  ),
  customerNote: z.string().trim().max(500).optional(),
  /** Server-side tie breaker: the client sends the cart revision it saw. */
  expectedCartUpdatedAt: z.string().optional(),
});

export const guestCheckoutSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  line1: z.string().trim().min(4, "Enter the address").max(200),
  line2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "Enter the city").max(80),
  state: z.string().trim().min(2, "Enter the state").max(80),
  pincode: pincodeSchema,
});

/**
 * Permitted order state transitions.
 *
 * The map is the single source of truth: the admin UI renders only the
 * transitions that exist here, and the server action rejects anything else.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [
    OrderStatus.AWAITING_PRESCRIPTION_APPROVAL,
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED,
  ],
  AWAITING_PRESCRIPTION_APPROVAL: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.DISPATCHED, OrderStatus.CANCELLED, OrderStatus.FAILED_DELIVERY],
  DISPATCHED: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.FAILED_DELIVERY],
  OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.FAILED_DELIVERY],
  DELIVERED: [],
  CANCELLED: [],
  FAILED_DELIVERY: [OrderStatus.PREPARING, OrderStatus.DISPATCHED, OrderStatus.CANCELLED],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export const orderStatusChangeSchema = z.object({
  orderId: z.string().uuid("Invalid order"),
  status: z.enum(
    Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]],
    { message: "Select a status" },
  ),
  note: z.string().trim().max(500).optional(),
});

export const orderCancelSchema = z.object({
  orderId: z.string().uuid("Invalid order"),
  reason: z.string().trim().min(3, "Enter a reason").max(500),
});

export const deliveryUpdateSchema = z.object({
  orderId: z.string().uuid("Invalid order"),
  status: z.enum(
    [
      "PENDING",
      "PREPARING",
      "DISPATCHED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "FAILED",
    ] as const,
    { message: "Select a delivery status" },
  ),
  note: z.string().trim().max(500).optional(),
  deliveredToName: z.string().trim().max(120).optional(),
  proofOfDeliveryNote: z.string().trim().max(500).optional(),
  failureReason: z.string().trim().max(500).optional(),
  assignedTo: z.string().trim().max(120).optional(),
});

export const prescriptionReviewSchema = z.object({
  requirementId: z.string().uuid("Invalid prescription requirement"),
  decision: z.enum(["APPROVED", "REJECTED"], { message: "Select a decision" }),
  reason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  /** Optional validity window, in days, for an approved prescription. */
  validForDays: requiredNumber
    .refine((value) => Number.isInteger(value) && value > 0 && value <= 365, "Enter 1-365 days")
    .optional(),
});

export const prescriptionUploadSchema = z.object({
  orderId: z.string().uuid("Invalid order").optional(),
  documentId: z.string().uuid("Invalid document").optional(),
});

export const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  sort: z
    .enum(["name_asc", "name_desc", "price_asc", "price_desc", "newest", "stock_asc"])
    .default("name_asc"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
