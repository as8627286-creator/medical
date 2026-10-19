import Link from "next/link";
import { listCategories, listProducts } from "@/lib/catalogue/products";
import { ProductGrid } from "@/components/product-card";
import { productSortSchema } from "@/lib/validation/catalogue";

const PAGE_SIZE = 20;

export async function generateMetadata(props: {
  searchParams: Promise<{ q?: string }>;
}): Promise<import("next").Metadata> {
  const { q } = await props.searchParams;
  return {
    title: q ? `Search: ${q}` : "Medicines",
    description: "Browse the medicines currently available for local delivery.",
  };
}

export default async function ProductsPage(props: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await props.searchParams;
  const sort = productSortSchema.safeParse(params.sort ?? "name_asc");
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [categories, result] = await Promise.all([
    listCategories(),
    listProducts({
      q: params.q,
      categorySlug: params.category,
      sort: sort.success ? sort.data : "name_asc",
      page,
      pageSize: PAGE_SIZE,
      onlineOnly: true,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const buildPageUrl = (target: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.category) search.set("category", params.category);
    if (params.sort) search.set("sort", params.sort);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return `/products${query ? `?${query}` : ""}`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span className="text-slate-700">Medicines</span>
      </nav>

      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {params.q ? `Results for "${params.q}"` : "All medicines"}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {result.total} product{result.total === 1 ? "" : "s"} available for online sale.
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <h2 className="text-sm font-semibold text-slate-900">Categories</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link
                href="/products"
                className={`block rounded px-2 py-1 ${
                  !params.category ? "bg-emerald-50 font-semibold text-emerald-900" : "text-slate-600 hover:underline"
                }`}
              >
                All
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className={`block rounded px-2 py-1 ${
                    params.category === category.slug
                      ? "bg-emerald-50 font-semibold text-emerald-900"
                      : "text-slate-600 hover:underline"
                  }`}
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 flex-1">
          <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
            {params.category ? (
              <input type="hidden" name="category" value={params.category} />
            ) : null}
            <div className="flex-1">
              <label htmlFor="q" className="block text-xs font-medium text-slate-700">
                Search
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={params.q ?? ""}
                placeholder="Medicine, brand or manufacturer"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label htmlFor="sort" className="block text-xs font-medium text-slate-700">
                Sort by
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={params.sort ?? "name_asc"}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="price_asc">Price (low to high)</option>
                <option value="price_desc">Price (high to low)</option>
                <option value="newest">Newest</option>
                <option value="stock_asc">Lowest stock</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Apply
            </button>
          </form>

          <ProductGrid products={result.products} />

          {totalPages > 1 ? (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
              {page > 1 ? (
                <Link
                  href={buildPageUrl(page - 1)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <p className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </p>
              {page < totalPages ? (
                <Link
                  href={buildPageUrl(page + 1)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
