import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { formatINR } from "@/lib/pricing";
import { OrderStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  await requirePermission(PERMISSIONS.PRODUCT_READ);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    productCount,
    activeProductCount,
    lowStockProducts,
    pendingPrescriptions,
    orderCount,
    openOrders,
    deliveredOrders,
    salesAggregate,
    recentOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({
      where: {
        isActive: true,
        stockQuantity: { lte: prisma.product.fields.lowStockThreshold },
      },
    }),
    prisma.prescriptionRequirement.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.order.count(),
    prisma.order.count({
      where: {
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.AWAITING_PRESCRIPTION_APPROVAL,
            OrderStatus.PREPARING,
            OrderStatus.DISPATCHED,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        },
      },
    }),
    prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
    prisma.order.aggregate({
      where: { status: OrderStatus.DELIVERED },
      _sum: { totalInPaise: true },
      _count: true,
    }),
    prisma.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 8,
      include: { user: { select: { fullName: true, email: true } } },
    }),
  ]);

  const cards = [
    { label: "Products (active)", value: `${activeProductCount} / ${productCount}` },
    { label: "Low stock alerts", value: String(lowStockProducts) },
    { label: "Orders (open / total)", value: `${openOrders} / ${orderCount}` },
    { label: "Delivered orders", value: String(deliveredOrders) },
    { label: "Pending prescription reviews", value: String(pendingPrescriptions) },
    {
      label: "Value of delivered orders",
      value: formatINR(salesAggregate._sum.totalInPaise ?? 0),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Orders, stock alerts and prescription reviews for today.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Add a product
        </Link>
      </header>

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </section>

      <section
        aria-labelledby="recent-orders-heading"
        className="rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="recent-orders-heading" className="text-base font-semibold text-slate-900">
            Recent orders
          </h2>
          <Link href="/admin/orders" className="text-sm font-medium text-emerald-800 hover:underline">
            View all
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No orders yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Most recent orders</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="py-2 pr-4">Order</th>
                  <th scope="col" className="py-2 pr-4">Customer</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2 pr-4">Total</th>
                  <th scope="col" className="py-2">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2 pr-4 font-medium text-slate-900">
                      <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{order.user.fullName}</td>
                    <td className="py-2 pr-4 text-slate-600">{order.status.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-4 text-slate-900">{formatINR(order.totalInPaise)}</td>
                    <td className="py-2 text-slate-500">
                      {order.placedAt.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
