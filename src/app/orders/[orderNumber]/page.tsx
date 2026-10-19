import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getOrderForUser } from "@/lib/orders/service";
import { formatINR } from "@/lib/pricing";
import { PrescriptionUpload } from "./prescription-upload";

export const metadata = { title: "Order", robots: { index: false, follow: false } };

const STATUS_STEPS = [
  "PENDING",
  "CONFIRMED",
  "AWAITING_PRESCRIPTION_APPROVAL",
  "PREPARING",
  "DISPATCHED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  AWAITING_PRESCRIPTION_APPROVAL: "Waiting for prescription review",
  PREPARING: "Being prepared",
  DISPATCHED: "Dispatched",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  FAILED_DELIVERY: "Delivery failed",
};

export default async function OrderDetailPage(props: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string; payment?: string }>;
}) {
  const { orderNumber } = await props.params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/orders/${orderNumber}`)}`);
  }

  const order = await getOrderForUser(orderNumber, user.id);
  if (!order) notFound();

  const steps = STATUS_STEPS.filter(
    (step) => step !== "AWAITING_PRESCRIPTION_APPROVAL" || order.requiresPrescription,
  );
  const currentIndex = steps.indexOf(order.status);
  const pendingPrescription = order.requiresPrescription && !order.prescriptionsApproved;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/orders" className="hover:underline">
          Orders
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span className="text-slate-700">{order.orderNumber}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Placed {order.placedAt.toLocaleString("en-IN")}
          </p>
        </div>
        <p className="text-xl font-bold text-slate-900">{formatINR(order.totalInPaise)}</p>
      </div>

      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Order progress">
        {steps.map((step, index) => {
          const done = currentIndex >= 0 && index <= currentIndex;
          const isCurrent = step === order.status;
          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isCurrent
                  ? "bg-emerald-700 text-white"
                  : done
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {STATUS_LABELS[step] ?? step}
            </li>
          );
        })}
      </ol>

      {order.status === "CANCELLED" ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          This order was cancelled{order.cancelReason ? `: ${order.cancelReason}` : "."}
        </p>
      ) : null}

      {pendingPrescription ? (
        <section className="mt-6 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <h2 className="text-base font-semibold text-sky-900">Prescription required</h2>
          <p className="mt-1 text-sm text-sky-900">
            One or more medicines in this order need a valid prescription. Upload
            it here. A pharmacist will review it before the order is dispensed.
          </p>
          <div className="mt-3">
            <PrescriptionUpload orderId={order.id} />
          </div>
        </section>
      ) : null}

      {order.requiresPrescription && order.prescriptionsApproved ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your prescription has been reviewed and approved.
        </p>
      ) : null}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Items</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 py-2 text-sm">
              <span>
                <span className="font-medium text-slate-900">{item.productName}</span>
                <span className="block text-xs text-slate-500">
                  {[item.productBrand, item.productStrength, item.productPackSize]
                    .filter(Boolean)
                    .join(" | ")}
                  {item.prescriptionRequired ? " | Prescription required" : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-slate-900">
                  {formatINR(item.lineTotalInPaise)}
                </span>
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
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>{formatINR(order.totalInPaise)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Delivery address</h2>
          <address className="mt-2 text-sm not-italic text-slate-600">
            {order.deliveryName}
            <br />
            {order.deliveryLine1}
            {order.deliveryLine2 ? (
              <>
                <br />
                {order.deliveryLine2}
              </>
            ) : null}
            {order.deliveryLandmark ? (
              <>
                <br />
                Near {order.deliveryLandmark}
              </>
            ) : null}
            <br />
            {order.deliveryCity}, {order.deliveryState} - {order.deliveryPincode}
            <br />
            Phone: {order.deliveryPhone}
          </address>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Payment</h2>
          {order.payments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No payment recorded yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {order.payments.map((payment) => (
                <li key={payment.id} className="flex justify-between">
                  <span className="text-slate-600">
                    {payment.method === "CASH_ON_DELIVERY" ? "Cash on delivery" : "Online"} &middot;{" "}
                    {payment.status.replace(/_/g, " ").toLowerCase()}
                  </span>
                  <span className="text-slate-900">{formatINR(payment.amountInPaise)}</span>
                </li>
              ))}
            </ul>
          )}
          {order.customerNote ? (
            <p className="mt-3 text-sm text-slate-600">Note: {order.customerNote}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
