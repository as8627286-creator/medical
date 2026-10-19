import { getStoreSettings } from "@/lib/store/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Returns and refunds" };

export default async function ReturnsPolicyPage() {
  const settings = await getStoreSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Returns and refunds</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
        {settings.refundPolicyText ? (
          <p className="whitespace-pre-line">{settings.refundPolicyText}</p>
        ) : (
          <p>
            The pharmacy has not published a returns and refunds policy yet.
          </p>
        )}
        <p>
          Please note that once a medicine has been dispensed it cannot be
          returned or exchanged. The exact policy, the conditions and the
          grievance process must be confirmed by the pharmacy before the
          storefront is used for real orders.
        </p>
      </div>
    </div>
  );
}
