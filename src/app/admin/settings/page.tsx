import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { getStoreSettings } from "@/lib/store/settings";
import { getEnv } from "@/lib/env";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Store settings" };

export default async function AdminSettingsPage() {
  const user = await requirePermission(PERMISSIONS.SETTINGS_READ);
  const settings = await getStoreSettings();
  const env = getEnv();
  const canWrite = hasPermission(user.role, PERMISSIONS.SETTINGS_WRITE);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Store settings</h1>
        <p className="text-sm text-slate-600">
          Pharmacy details, policies, delivery defaults and the switches that
          control whether the storefront accepts orders.
        </p>
      </header>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">These switches are not a legal approval.</p>
        <p className="mt-1">
          &quot;Compliance confirmed&quot; records that the pharmacy has completed
          the checklist in <code>docs/PHARMACY_COMPLIANCE_CHECKLIST.md</code>. It
          does not grant any licence, registration or permission to sell
          medicines online. The current state is{" "}
          <strong>{settings.complianceConfirmed ? "confirmed" : "not confirmed"}</strong>,
          online sales are <strong>{settings.salesEnabled ? "on" : "off"}</strong>{" "}
          and live payments are{" "}
          <strong>
            {settings.livePaymentsEnabled && env.PAYMENT_LIVE ? "on" : "off"}
          </strong>
          .
        </p>
      </div>

      <SettingsForm settings={settings} canWrite={canWrite} paymentProvider={env.PAYMENT_PROVIDER} paymentLive={env.PAYMENT_LIVE} />
    </div>
  );
}
