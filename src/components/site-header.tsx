import Link from "next/link";
import { getStoreSettings } from "@/lib/store/settings";
import { getSessionUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/rbac";
import { logoutAction } from "@/app/login/actions";

export async function SiteHeader() {
  const [settings, user] = await Promise.all([getStoreSettings(), getSessionUser()]);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-lg font-bold text-white"
          >
            +
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            {settings.pharmacyName}
          </span>
        </Link>

        <form action="/products" method="get" className="order-3 flex w-full flex-1 sm:order-2 sm:w-auto">
          <label htmlFor="site-search" className="sr-only">
            Search medicines
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search by medicine, brand or manufacturer"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </form>

        <nav aria-label="Primary" className="order-2 ml-auto flex items-center gap-4 sm:order-3">
          <Link href="/products" className="text-sm font-medium text-slate-700 hover:text-emerald-800">
            Medicines
          </Link>
          <Link href="/cart" className="text-sm font-medium text-slate-700 hover:text-emerald-800">
            Cart
          </Link>
          {user ? (
            <>
              {isStaffRole(user.role.code) ? (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-slate-700 hover:text-emerald-800"
                >
                  Admin
                </Link>
              ) : null}
              <Link
                href="/orders"
                className="text-sm font-medium text-slate-700 hover:text-emerald-800"
              >
                Orders
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-sm font-medium text-slate-700 hover:text-emerald-800"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
