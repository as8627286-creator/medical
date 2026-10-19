import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { formatINR } from "@/lib/pricing";
import { ORDER_TRANSITIONS } from "@/lib/validation/commerce";
import { OrderStatus } from "@/generated/prisma/enums";
import { OrderStatusForm, DeliveryForm, CancelOrderForm } from "./order-forms";

export const metadata = { title: "Order details" };

export default async function AdminOrderPage(props: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await props.params;
  const user = await requirePermission(PERMISSIONS.ORDER_READ, `/admin/orders/${orderNumber}`);

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true } },
      items: { include: { prescriptionRequirement: true } },
      payments: { orderBy: { createdAt: "desc" } },
      delivery: true,
      deliveryZone: true,
      prescriptions: { select: { id: true, uploadedAt: true, mimeType: true } },
    },
  });

  if (!order) notFound();

  const auditEvents = await prisma.auditEvent.findMany({
    where: { entityId: order.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: { select: { fullName: true } } },
  });

  const transitions = ORDER_TRANSITIONS[order.status] ?? [];
  const canWrite = user.role.permissions.includes(PERMISSIONS.ORDER_WRITE);
  const canCancel = user.role.permissions.includes(PERMISSIONS.ORDER_CANCEL);
  const canDeliver = user.role.permissions.includes(PERMISSIONS.DELIVERY_WRITE);

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/admin/orders" className="hover:underline">
          Orders
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span className="text-slate-700">{order.orderNumber}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {order.status.replace(/_/g, " ")} &middot; placed{" "}
            {order.placedAt.toLocaleString("en-IN")}
          </p>
        </div>
        <p className="text-xl font-bold text-slate-900">{formatINR(order.totalInPaise)}</p>
      </header>

      {order.requiresPrescription ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            order.prescriptionsApproved
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-900"
          }`}
        >
          {order.prescriptionsApproved
            ? "All prescription requirements for this order are approved."
            : "This order is waiting for a prescription review and cannot be prepared or dispatched yet."}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">Items</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-4 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-slate-900">{item.productName}</span>
                    <span className="block text-xs text-slate-500">
                      {item.productSku} &middot; {[item.productBrand, item.productStrength, item.productPackSize]
                        .filter(Boolean)
                        .join(" | ")}
                    </span>
                    {item.prescriptionRequired ? (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Prescription:{" "}
                        {item.prescriptionRequirement?.status.replace(/_/g, " ").toLowerCase() ??
                          "not required"}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-right">
                    <span className="block text-slate-900">{formatINR(item.lineTotalInPaise)}</span>
                    <span className="block text-xs text-slate-500">
                      {item.quantity} &times; {formatINR(item.unitPriceInPaise)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="text-slate-900">{formatINR(order.subtotalInPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Delivery charge</dt>
                <dd className="text-slate-900">{formatINR(order.deliveryFeeInPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Tax included</dt>
                <dd className="text-slate-900">{formatINR(order.taxInPaise)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Total</dt>
                <dd>{formatINR(order.totalInPaise)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">Order history</h2>
            {auditEvents.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No recorded events yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {auditEvents.map((event) => (
                  <li key={event.id} className="border-l-2 border-slate-200 pl-3">
                    <p className="text-slate-900">{event.summary}</p>
                    <p className="text-xs text-slate-500">
                      {event.createdAt.toLocaleString("en-IN")}
                      {event.actor?.fullName ? ` &middot; ${event.actor.fullName}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {canWrite && transitions.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-900">Update status</h2>
              <OrderStatusForm orderId={order.id} transitions={transitions} />
            </section>
          ) : null}

          {canDeliver ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-900">Delivery</h2>
              <DeliveryForm
                orderId={order.id}
                current={order.delivery?.status ?? "PENDING"}
                zone={order.deliveryZone?.name ?? null}
              />
            </section>
          ) : null}

          {canCancel && order.status !== OrderStatus.CANCELLED ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-900">Cancel order</h2>
              <CancelOrderForm orderId={order.id} />
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">Customer</h2>
            <p className="mt-2 text-sm text-slate-600">{order.user.fullName}</p>
            <p className="text-sm text-slate-600">{order.user.email}</p>
            {order.user.phone ? (
              <p className="text-sm text-slate-600">{order.user.phone}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">Delivery address</h2>
            <address className="mt-2 text-sm not-italic text-slate-600">
              {order.deliveryName}
              <br />
              {order.deliveryLine1}
              {order.deliveryLine2 ? `, ${order.deliveryLine2}` : ""}
              <br />
              {order.deliveryCity}, {order.deliveryState} - {order.deliveryPincode}
              <br />
              Phone: {order.deliveryPhone}
            </address>
            {order.customerNote ? (
              <p className="mt-2 text-sm text-slate-600">Note: {order.customerNote}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">Payment</h2>
            {order.payments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No payment recorded.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {order.payments.map((payment) => (
                  <li key={payment.id}>
                    <p className="text-slate-900">
                      {formatINR(payment.amountInPaise)} &middot;{" "}
                      {payment.status.replace(/_/g, " ").toLowerCase()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {payment.method === "CASH_ON_DELIVERY" ? "Cash on delivery" : "Online"} &middot;{" "}
                      {payment.provider}
                    </p>
                    {payment.providerPaymentId ? (
                      <p className="break-all text-xs text-slate-400">
                        {payment.providerPaymentId}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {order.prescriptions.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-900">Prescriptions</h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {order.prescriptions.map((document) => (
                  <li key={document.id}>
                    Uploaded {document.uploadedAt.toLocaleString("en-IN")} &middot;{" "}
                    {document.mimeType}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                Documents are opened from the prescription review queue, which
                records every access.
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
