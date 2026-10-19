import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getProductById, listProducts } from "@/lib/catalogue/products";
import { evaluateEligibility } from "@/lib/catalogue/eligibility";
import { formatINR } from "@/lib/pricing";
import { ProductImage } from "@/components/product-image";
import { AddToCart } from "./add-to-cart";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<import("next").Metadata> {
  const { id } = await props.params;
  const product = await getProductById(id);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description ?? undefined,
  };
}

export default async function ProductDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const product = await getProductById(id);
  if (!product) notFound();

  const user = await getSessionUser();

  const eligibility = evaluateEligibility({
    isActive: product.isActive,
    saleEligibility: product.saleEligibility,
    legalRestriction: product.legalRestriction,
    prescriptionRequired: product.prescriptionRequired,
    stockQuantity: product.stockQuantity,
    reservedQuantity: product.reservedQuantity,
  });

  const related = await listProducts({
    categorySlug: product.category.slug,
    pageSize: 5,
    onlineOnly: true,
  });

  const image = product.images[0];
  const available = eligibility.availableQuantity;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <Link href="/products" className="hover:underline">
          Medicines
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <Link
          href={`/products?category=${encodeURIComponent(product.category.slug)}`}
          className="hover:underline"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <div className="flex h-80 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white sm:h-96">
          <ProductImage
            src={image?.url ?? ""}
            alt={image?.altText ?? `${product.name} product photo`}
            width={480}
            height={480}
            sizes="(max-width: 1024px) 100vw, 480px"
            className="h-full w-full object-contain p-6"
          />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {[product.brand, product.manufacturer].filter(Boolean).join(" | ")}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {[product.strength, product.dosageForm.replace("_", " ").toLowerCase(), product.packSize]
              .filter(Boolean)
              .join(" | ")}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {eligibility.prescriptionRequired ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Prescription required
              </span>
            ) : null}
            {available > 0 ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                In stock
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Out of stock
              </span>
            )}
          </div>

          <div className="mt-4">
            {product.mrpInPaise && product.mrpInPaise > product.sellingPriceInPaise ? (
              <p className="text-sm text-slate-400 line-through">
                {formatINR(product.mrpInPaise)}
              </p>
            ) : null}
            <p className="text-3xl font-bold text-slate-900">
              {formatINR(product.sellingPriceInPaise)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Price inclusive of tax. SKU {product.sku}.
            </p>
          </div>

          {eligibility.sellableOnline ? (
            <AddToCart productId={product.id} maxQuantity={available} signedIn={Boolean(user)} />
          ) : (
            <p className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {eligibility.reason ?? "This product is not available for online sale."}
            </p>
          )}

          {eligibility.prescriptionRequired ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This medicine is supplied only against a valid prescription that has
              been reviewed by authorised pharmacy personnel. Uploading a
              prescription is not an approval.
            </p>
          ) : null}
        </div>
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        {product.description ? (
          <div>
            <h2 className="text-base font-semibold text-slate-900">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {product.description}
            </p>
          </div>
        ) : null}

        {product.warnings ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-base font-semibold text-amber-900">Warnings</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-amber-900">
              {product.warnings}
            </p>
          </div>
        ) : null}

        {product.usageInformation ? (
          <div>
            <h2 className="text-base font-semibold text-slate-900">Usage information</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {product.usageInformation}
            </p>
          </div>
        ) : null}

        {product.storageInstructions ? (
          <div>
            <h2 className="text-base font-semibold text-slate-900">Storage</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {product.storageInstructions}
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Important</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This page reproduces the information printed on the pack. It does not
          give medical advice and it does not recommend this or any other
          medicine. Follow the advice of your doctor or pharmacist, and read the
          label before use.
        </p>
      </section>

      {related.products.filter((item) => item.id !== product.id).length > 0 ? (
        <section className="mt-10">
          <h2 className="text-base font-semibold text-slate-900">
            More in {product.category.name}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.products
              .filter((item) => item.id !== product.id)
              .slice(0, 4)
              .map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <Link
                    href={`/products/${item.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {[item.brand, item.strength].filter(Boolean).join(" | ")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatINR(item.sellingPriceInPaise)}
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
