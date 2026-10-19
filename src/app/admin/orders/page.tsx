import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { formatINR } from "@/lib/pricing";
import { OrderStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 25;

export default async function AdminOrdersPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission(PERMISSIONS.ORDER_READ);
  const params = await props.searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status = params.status && params.status !== "ALL" ? params.status : undefined;
  const q = params.q?.trim();

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { fullName: { contains: q, mode: "insensitive" } } },
      { deliveryPhone: { contains: q } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { fullName: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const statuses = Object.values(OrderStatus);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="text-sm text-slate-600">{total} order{total === 1 ? "" : "s"} found.</p>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="q" className="block text-xs font-medium text-slate-700">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Order number, customer or phone"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-slate-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? "ALL"}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Filter
        </button>
      </form>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No orders match the current filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <caption className="sr-only">Orders</caption>
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Order</th>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Payment</th>
                <th scope="col" className="px-4 py-3">Items</th>
                <th scope="col" className="px-4 py-3">Total</th>
                <th scope="col" className="px-4 py-3">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.orderNumber}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.user.fullName}
                    <span className="block text-xs text-slate-400">{order.user.email}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.status.replace(/_/g, " ").toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.paymentMethod === "CASH_ON_DELIVERY" ? "COD" : "Online"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{order._count.items}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatINR(order.totalInPaise)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {order.placedAt.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          {page > 1 ? (
            <Link
              href={`/admin/orders?page=${page - 1}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-slate-600">
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </p>
          {page < Math.ceil(total / PAGE_SIZE) ? (
            <Link
              href={`/admin/orders?page=${page + 1}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
