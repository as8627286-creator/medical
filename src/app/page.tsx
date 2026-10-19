import Link from "next/link";
import { listCategories, listProducts } from "@/lib/catalogue/products";
import { getStoreSettings } from "@/lib/store/settings";
import { ProductGrid } from "@/components/product-card";
import { formatINR } from "@/lib/pricing";

export default async function HomePage() {
  const [settings, categories, featured] = await Promise.all([
    getStoreSettings(),
    listCategories(),
    listProducts({ pageSize: 8, sort: "newest", onlineOnly: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <section className="rounded-2xl bg-emerald-800 px-6 py-10 text-white sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {settings.pharmacyName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-emerald-50 sm:text-base">
          Browse the medicines we currently stock and order for local delivery.
          Prescription-only products are supplied only after a pharmacist has
          reviewed your prescription.
        </p>
        <form action="/products" method="get" className="mt-6 flex max-w-xl gap-2">
          <label htmlFor="home-search" className="sr-only">
            Search medicines
          </label>
          <input
            id="home-search"
            name="q"
            type="search"
            placeholder="Search by medicine, brand or manufacturer"
            className="min-w-0 flex-1 rounded-lg border border-transparent px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <button
            type="submit"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Search
          </button>
        </form>
      </section>

      {settings.salesEnabled ? null : (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Development mode.</strong> Browsing is available, but new
          orders are not accepted until the pharmacy completes the regulatory
          and licensing checklist.
        </p>
      )}

      <section aria-labelledby="categories-heading" className="mt-10">
        <h2 id="categories-heading" className="text-xl font-semibold text-slate-900">
          Categories
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.length === 0 ? (
            <li className="text-sm text-slate-500">No categories yet.</li>
          ) : (
            categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="inline-block rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-emerald-600 hover:text-emerald-800"
                >
                  {category.name}
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-labelledby="featured-heading" className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 id="featured-heading" className="text-xl font-semibold text-slate-900">
            Featured medicines
          </h2>
          <Link href="/products" className="text-sm font-medium text-emerald-800 hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-4">
          <ProductGrid products={featured.products} />
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Local delivery</h3>
          <p className="mt-2 text-sm text-slate-600">
            We deliver to serviceable PIN codes. Delivery charges and minimum
            order values are shown at checkout.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Pharmacist review</h3>
          <p className="mt-2 text-sm text-slate-600">
            Prescription-only medicines are reviewed by authorised pharmacy
            personnel before they are dispensed.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">No medical advice</h3>
          <p className="mt-2 text-sm text-slate-600">
            We do not recommend medicines or doses. Please follow the advice of
            your doctor or pharmacist.
          </p>
        </div>
      </section>

      {settings.minOrderAmountInPaise > 0 ? (
        <p className="mt-8 text-sm text-slate-500">
          Minimum order value: {formatINR(settings.minOrderAmountInPaise)}.
        </p>
      ) : null}
    </div>
  );
}
