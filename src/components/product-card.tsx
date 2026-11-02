import Link from "next/link";
import { formatINR } from "@/lib/pricing";
import { ProductImage } from "@/components/product-image";
import type { CatalogueProductWithRelations } from "@/lib/catalogue/products";

export function ProductCard({ product }: { product: CatalogueProductWithRelations }) {
  const image = product.images[0];
  const inStock = product.stockQuantity - product.reservedQuantity > 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link
        href={`/products/${encodeURIComponent(product.id)}`}
        className="flex h-44 items-center justify-center overflow-hidden bg-slate-50"
      >
        <ProductImage
          src={image?.url ?? ""}
          alt={image?.altText ?? `${product.name} product photo`}
          width={image?.width ?? 320}
          height={image?.height ?? 320}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="h-44 w-full object-contain p-3"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {product.prescriptionRequired ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              Prescription required
            </span>
          ) : null}
          {inStock ? null : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              Out of stock
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold leading-snug text-slate-900">
          <Link href={`/products/${encodeURIComponent(product.id)}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>

        <p className="text-xs text-slate-500">
          {[product.brand, product.strength, product.packSize].filter(Boolean).join(" | ")}
        </p>

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            {product.mrpInPaise && product.mrpInPaise > product.sellingPriceInPaise ? (
              <p className="text-xs text-slate-400 line-through">{formatINR(product.mrpInPaise)}</p>
            ) : null}
            <p className="text-base font-bold text-slate-900">
              {formatINR(product.sellingPriceInPaise)}
            </p>
          </div>
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            {product.dosageForm.replace("_", " ").toLowerCase()}
          </span>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: CatalogueProductWithRelations[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">No medicines match your search.</p>
        <p className="mt-1 text-sm text-slate-500">
          Try a different name, brand or manufacturer, or browse all categories.
        </p>
        <Link
          href="/products"
          className="mt-4 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Browse all medicines
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
