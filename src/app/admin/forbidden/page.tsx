import Link from "next/link";

export const metadata = {
  title: "Not permitted",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Not permitted</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your account does not have permission to perform this action. Every
        protected action is checked on the server, not only in the interface.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
