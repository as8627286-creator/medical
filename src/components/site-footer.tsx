import Link from "next/link";
import { getStoreSettings } from "@/lib/store/settings";

export async function SiteFooter() {
  const settings = await getStoreSettings();

  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{settings.pharmacyName}</p>
          <p className="mt-2 text-sm text-slate-600">
            {settings.addressLine1 ? (
              <>
                {settings.addressLine1}
                <br />
              </>
            ) : null}
            {settings.city ? `${settings.city}${settings.pincode ? ` - ${settings.pincode}` : ""}` : null}
          </p>
          {settings.phone ? (
            <p className="mt-2 text-sm text-slate-600">
              Phone: <a href={`tel:${settings.phone}`} className="hover:underline">{settings.phone}</a>
            </p>
          ) : null}
          {settings.email ? (
            <p className="text-sm text-slate-600">
              Email: <a href={`mailto:${settings.email}`} className="hover:underline">{settings.email}</a>
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">Information</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>
              <Link href="/policies/delivery" className="hover:underline">
                Delivery policy
              </Link>
            </li>
            <li>
              <Link href="/policies/returns" className="hover:underline">
                Returns and refunds
              </Link>
            </li>
            <li>
              <Link href="/policies/privacy" className="hover:underline">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:underline">
                Contact us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">Dispensing</h2>
          <p className="mt-2 text-sm text-slate-600">
            Medicines are dispensed by a registered pharmacist. Products marked
            &quot;Prescription required&quot; are supplied only against a valid
            prescription that has been reviewed.
          </p>
          {settings.pharmacistName ? (
            <p className="mt-2 text-sm text-slate-600">
              Pharmacist: {settings.pharmacistName}
              {settings.pharmacistRegistrationNumber
                ? ` (Reg. ${settings.pharmacistRegistrationNumber})`
                : ""}
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">Important notice</h2>
          <p className="mt-2 text-sm text-slate-600">
            This site does not give medical advice and does not recommend
            medicines or doses. Follow the advice of your doctor or pharmacist.
          </p>
          {!settings.complianceConfirmed ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Development mode: online sales are disabled until the pharmacy
              confirms the regulatory checklist.
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-4 text-center text-xs text-slate-500">
        <p>
          &copy; {new Date().getFullYear()} {settings.legalName ?? settings.pharmacyName}. All rights
          reserved.
        </p>
        {settings.licenseNumber ? (
          <p className="mt-1">Retail drug licence: {settings.licenseNumber}</p>
        ) : null}
      </div>
    </footer>
  );
}
