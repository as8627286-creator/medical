import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { listZones } from "@/lib/delivery/zones";
import { formatINR } from "@/lib/pricing";
import { ZoneForm, ZoneFeeForm } from "./zone-forms";

export const dynamic = "force-dynamic";

export const metadata = { title: "Delivery zones" };

export default async function AdminDeliveryPage() {
  await requirePermission(PERMISSIONS.DELIVERY_ZONE_WRITE);
  const zones = await listZones();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Delivery zones</h1>
        <p className="text-sm text-slate-600">
          A PIN code belongs to exactly one zone. The zone decides the delivery
          charge, the minimum order value and the delivery window shown to the
          customer.
        </p>
      </header>

      {zones.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No delivery zones yet. Add one below.
        </p>
      ) : (
        <ul className="space-y-4">
          {zones.map((zone) => (
            <li key={zone.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{zone.name}</h2>
                  <p className="text-xs text-slate-500">
                    {zone.city ?? "No city set"} &middot;{" "}
                    {zone.pincodes.length} PIN code{zone.pincodes.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    zone.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {zone.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-slate-500">Delivery charge</dt>
                  <dd className="font-medium text-slate-900">
                    {formatINR(zone.deliveryFeeInPaise)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Minimum order</dt>
                  <dd className="font-medium text-slate-900">
                    {formatINR(zone.minOrderAmountInPaise)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Delivery window</dt>
                  <dd className="font-medium text-slate-900">
                    {zone.estimatedDaysMin !== null || zone.estimatedDaysMax !== null
                      ? `${zone.estimatedDaysMin ?? 0}-${zone.estimatedDaysMax ?? 0} days`
                      : "Not configured"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Order cutoff</dt>
                  <dd className="font-medium text-slate-900">
                    {zone.orderCutoffTime ?? "Not configured"}
                  </dd>
                </div>
              </dl>

              {zone.pincodes.length > 0 ? (
                <p className="mt-3 text-xs text-slate-600">
                  PIN codes: {zone.pincodes.map((pincode) => pincode.pincode).join(", ")}
                </p>
              ) : null}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ZoneFeeForm
                  zoneId={zone.id}
                  deliveryFee={String(zone.deliveryFeeInPaise / 100)}
                  minOrderAmount={String(zone.minOrderAmountInPaise / 100)}
                />
                <form action={undefined} className="flex items-end">
                  <span className="text-xs text-slate-500">
                    Deactivate a zone to stop new orders from using it. Existing
                    orders are not affected.{" "}
                    <Link href="/admin/orders" className="underline">
                      Review orders
                    </Link>
                  </span>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Add a delivery zone</h2>
        <div className="mt-3">
          <ZoneForm />
        </div>
      </section>
    </div>
  );
}
