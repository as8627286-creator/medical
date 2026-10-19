import { getStoreSettings } from "@/lib/store/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Delivery policy" };

export default async function DeliveryPolicyPage() {
  const settings = await getStoreSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Delivery policy</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
        {settings.deliveryPolicyText ? (
          <p className="whitespace-pre-line">{settings.deliveryPolicyText}</p>
        ) : (
          <p>
            The pharmacy has not published a delivery policy yet. Delivery is
            offered to serviceable PIN codes only; the delivery charge and
            minimum order value for your PIN code are shown at checkout.
          </p>
        )}
        <p>
          Delivery windows shown at checkout are estimates based on the
          configured zones. They are not a guaranteed delivery date, and no
          delivery date is promised that the pharmacy cannot support.
        </p>
        <p>
          Medicines that require a prescription are dispensed only after the
          prescription has been reviewed by authorised pharmacy personnel.
        </p>
      </div>
    </div>
  );
}
