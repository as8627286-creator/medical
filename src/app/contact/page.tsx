import { getStoreSettings } from "@/lib/store/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contact" };

export default async function ContactPage() {
  const settings = await getStoreSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Contact us</h1>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Pharmacy</dt>
          <dd className="text-slate-900">{settings.legalName ?? settings.pharmacyName}</dd>
        </div>
        {settings.addressLine1 ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Address</dt>
            <dd className="text-slate-900">
              {settings.addressLine1}
              {settings.addressLine2 ? `, ${settings.addressLine2}` : ""}
              {settings.city ? `, ${settings.city}` : ""}
              {settings.pincode ? ` - ${settings.pincode}` : ""}
            </dd>
          </div>
        ) : null}
        {settings.phone ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt>
            <dd className="text-slate-900">
              <a href={`tel:${settings.phone}`} className="hover:underline">
                {settings.phone}
              </a>
            </dd>
          </div>
        ) : null}
        {settings.email ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="text-slate-900">
              <a href={`mailto:${settings.email}`} className="hover:underline">
                {settings.email}
              </a>
            </dd>
          </div>
        ) : null}
        {settings.businessHours ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Business hours
            </dt>
            <dd className="text-slate-900">{settings.businessHours}</dd>
          </div>
        ) : null}
        {settings.pharmacistName ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Responsible pharmacist
            </dt>
            <dd className="text-slate-900">
              {settings.pharmacistName}
              {settings.pharmacistRegistrationNumber
                ? ` (Reg. ${settings.pharmacistRegistrationNumber})`
                : ""}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
