import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { listAllRequirements, listPendingReviews } from "@/lib/prescriptions/service";
import { PrescriptionStatus } from "@/generated/prisma/enums";
import { ReviewForm } from "./review-form";

export const metadata = { title: "Prescriptions" };

export default async function AdminPrescriptionsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.PRESCRIPTION_READ);
  const { status } = await props.searchParams;

  const filter =
    status && Object.values(PrescriptionStatus).includes(status as PrescriptionStatus)
      ? (status as PrescriptionStatus)
      : undefined;

  const [pending, all] = await Promise.all([
    listPendingReviews(),
    listAllRequirements(filter),
  ]);

  const canReview = hasPermission(user.role, PERMISSIONS.PRESCRIPTION_REVIEW);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Prescription review</h1>
        <p className="text-sm text-slate-600">
          {pending.length} prescription{pending.length === 1 ? "" : "s"} waiting for
          review. Only authorised pharmacy personnel may record a decision.
        </p>
      </header>

      {!canReview ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view the queue but you are not authorised to record a decision.
        </p>
      ) : null}

      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="text-base font-semibold text-slate-900">
          Waiting for review
        </h2>

        {pending.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Nothing is waiting for review.
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {pending.map((requirement) => (
              <li
                key={requirement.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {requirement.orderItem.productName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Order{" "}
                      <Link
                        href={`/admin/orders/${requirement.orderItem.order.orderNumber}`}
                        className="hover:underline"
                      >
                        {requirement.orderItem.order.orderNumber}
                      </Link>{" "}
                      &middot; {requirement.orderItem.order.user.fullName} &middot;{" "}
                      {requirement.orderItem.order.user.phone ?? requirement.orderItem.order.deliveryPhone}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    {requirement.status.replace(/_/g, " ").toLowerCase()}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  {requirement.document ? (
                    <>
                      <a
                        href={`/api/admin/prescriptions/${requirement.document.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Open prescription ({requirement.document.mimeType})
                      </a>
                      <span className="text-xs text-slate-500">
                        Uploaded {requirement.document.uploadedAt.toLocaleString("en-IN")} &middot;{" "}
                        {Math.round(requirement.document.bytes / 1024)} KB
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">No document uploaded.</span>
                  )}
                </div>

                <ReviewForm requirementId={requirement.id} canApprove={canReview} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading" className="pt-4">
        <h2 id="history-heading" className="text-base font-semibold text-slate-900">
          All requirements
        </h2>

        <form method="get" className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-slate-700">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {Object.values(PrescriptionStatus).map((value) => (
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

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Prescription requirements</caption>
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Product</th>
                <th scope="col" className="px-4 py-3">Order</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Reviewed by</th>
                <th scope="col" className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {all.map((requirement) => (
                <tr key={requirement.id}>
                  <td className="px-4 py-3 text-slate-900">
                    {requirement.orderItem.productName}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${requirement.orderItem.order.orderNumber}`}
                      className="text-slate-600 hover:underline"
                    >
                      {requirement.orderItem.order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {requirement.status.replace(/_/g, " ").toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {requirement.reviews[0]?.reviewer.fullName ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {requirement.updatedAt.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
