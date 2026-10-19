import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { formatINR } from "@/lib/pricing";
import { ProductImage } from "@/components/product-image";
import { productSearchSchema } from "@/lib/validation/catalogue";

export const metadata = { title: "Products" };

export default async function AdminProductsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const params = await props.searchParams;

  const parsed = productSearchSchema.safeParse({
    q: params.q,
    categoryId: params.categoryId,
    includeInactive: params.includeInactive === "true",
    page: params.page,
    pageSize: params.pageSize,
  });

  const options = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, includeInactive: false };

  const where: Record<string, unknown> = {};
  if (options.q) where.searchText = { contains: options.q.trim().toLowerCase() };
  if (options.categoryId) where.categoryId = options.categoryId;
  if (!options.includeInactive) where.isActive = true;

  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      include: {
        category: { select: { name: true } },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, variants: true, width: true, height: true },
        },
      },
    }),
    prisma.product.count({ where }),
    prisma.productCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-600">
            {total} product{total === 1 ? "" : "s"} in the catalogue.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Add a product
        </Link>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="q" className="block text-xs font-medium text-slate-700">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Name, brand, SKU or manufacturer"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
        </div>
        <div>
          <label htmlFor="categoryId" className="block text-xs font-medium text-slate-700">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={params.categoryId ?? ""}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="includeInactive"
            value="true"
            defaultChecked={params.includeInactive === "true"}
            className="h-4 w-4 rounded border-slate-300"
          />
          Include inactive
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Filter
        </button>
      </form>

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No products match the current filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Catalogue products</caption>
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Product</th>
                <th scope="col" className="px-4 py-3">SKU</th>
                <th scope="col" className="px-4 py-3">Category</th>
                <th scope="col" className="px-4 py-3">Price</th>
                <th scope="col" className="px-4 py-3">Stock</th>
                <th scope="col" className="px-4 py-3">Flags</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => {
                const available = product.stockQuantity - product.reservedQuantity;
                const low = available <= product.lowStockThreshold;
                return (
                  <tr key={product.id} className="align-middle">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                          <ProductImage
                            src={product.images[0]?.url ?? ""}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="h-12 w-12 object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="font-medium text-slate-900 hover:underline"
                          >
                            {product.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {[product.brand, product.strength, product.packSize]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{product.sku}</td>
                    <td className="px-4 py-3 text-slate-600">{product.category.name}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {formatINR(product.sellingPriceInPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          low ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {available}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {product.prescriptionRequired ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Rx
                          </span>
                        ) : null}
                        {product.legalRestriction !== "NONE" ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                            {product.legalRestriction.replace(/_/g, " ")}
                          </span>
                        ) : null}
                        {product.saleEligibility === "NOT_FOR_ONLINE_SALE" ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            Offline only
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          product.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
