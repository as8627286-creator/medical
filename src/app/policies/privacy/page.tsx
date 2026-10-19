import { getStoreSettings } from "@/lib/store/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Privacy" };

export default async function PrivacyPolicyPage() {
  const settings = await getStoreSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Privacy</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
        {settings.privacyPolicyText ? (
          <p className="whitespace-pre-line">{settings.privacyPolicyText}</p>
        ) : (
          <p>The pharmacy has not published a privacy policy yet.</p>
        )}
        <h2 className="text-base font-semibold text-slate-900">
          What this application stores
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Your name, email address, phone number and delivery addresses.
          </li>
          <li>
            Your orders, including a snapshot of the product name, SKU, price
            and tax applied at the time of the order.
          </li>
          <li>
            Prescription documents that you upload, and the review decision
            recorded against them.
          </li>
        </ul>
        <p>
          Prescription documents are stored privately. They are not reachable
          through a public URL, and every access by pharmacy personnel is
          recorded in the audit log.
        </p>
        <p>
          Payment card details are never stored. Card data is handled entirely
          by the payment provider.
        </p>
      </div>
    </div>
  );
}
