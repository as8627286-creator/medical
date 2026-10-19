import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

export default async function AdminAuditPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission(PERMISSIONS.AUDIT_READ);
  const params = await props.searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const action = params.action && params.action !== "ALL" ? params.action : undefined;
  const entityType = params.entityType && params.entityType !== "ALL" ? params.entityType : undefined;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;

  const [events, total, actions, entityTypes] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { fullName: true, email: true } } },
    }),
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.groupBy({ by: ["action"], _count: { action: true } }),
    prisma.auditEvent.groupBy({ by: ["entityType"], _count: { entityType: true } }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-600">
          {total} recorded event{total === 1 ? "" : "s"}. Passwords, session tokens
          and payment secrets are never recorded.
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="action" className="block text-xs font-medium text-slate-700">
            Action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={params.action ?? "ALL"}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            {actions.map((entry) => (
              <option key={entry.action} value={entry.action}>
                {entry.action.replace(/_/g, " ")} ({entry._count.action})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="entityType" className="block text-xs font-medium text-slate-700">
            Entity
          </label>
          <select
            id="entityType"
            name="entityType"
            defaultValue={params.entityType ?? "ALL"}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            {entityTypes.map((entry) => (
              <option key={entry.entityType} value={entry.entityType}>
                {entry.entityType} ({entry._count.entityType})
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <caption className="sr-only">Audit events</caption>
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">When</th>
              <th scope="col" className="px-4 py-3">Action</th>
              <th scope="col" className="px-4 py-3">Entity</th>
              <th scope="col" className="px-4 py-3">Summary</th>
              <th scope="col" className="px-4 py-3">Actor</th>
              <th scope="col" className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((event) => (
              <tr key={event.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {event.createdAt.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {event.action.replace(/_/g, " ").toLowerCase()}
                </td>
                <td className="px-4 py-3 text-slate-600">{event.entityType}</td>
                <td className="px-4 py-3 text-slate-900">{event.summary}</td>
                <td className="px-4 py-3 text-slate-600">
                  {event.actor?.fullName ?? event.actorRole ?? "system"}
                </td>
                <td className="px-4 py-3 text-slate-500">{event.ipAddress ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE ? (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          {page > 1 ? (
            <a
              href={`/admin/audit?page=${page - 1}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Previous
            </a>
          ) : (
            <span />
          )}
          <p className="text-sm text-slate-600">
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </p>
          {page < Math.ceil(total / PAGE_SIZE) ? (
            <a
              href={`/admin/audit?page=${page + 1}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Next
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
