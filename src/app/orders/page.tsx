import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { listOrdersForUser } from "@/lib/orders/service";
import { formatINR } from "@/lib/pricing";

export const metadata = { title: "Your orders", robots: { index: false, follow: false } };

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

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=%2Forders");
  }

  const orders = await listOrdersForUser(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Your orders</h1>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">You have not placed any orders yet.</p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Browse medicines
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/orders/${order.orderNumber}`}
                    className="text-sm font-semibold text-slate-900 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Placed {order.placedAt.toLocaleString("en-IN")} &middot;{" "}
                    {order.paymentMethod === "CASH_ON_DELIVERY"
                      ? "Cash on delivery"
                      : "Online payment"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {formatINR(order.totalInPaise)}
                  </p>
                  <p className="mt-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {STATUS_LABELS[order.status] ?? order.status}
                  </p>
                </div>
              </div>

              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} &times; {item.productName}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
