import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { formatINR, paiseToRupees } from "@/lib/pricing";
import { ProductForm, type ProductFormValues } from "../product-form";
import { ImageManager } from "../image-manager";
import { LegalRestrictionManager, PriceManager, StockManager } from "../managers";
import { setProductActiveAction, updateProductAction } from "../actions";

export const metadata = { title: "Edit product" };

export default async function AdminProductPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await props.params;
  const user = await requirePermission(PERMISSIONS.PRODUCT_READ, `/admin/products/${id}`);

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      priceHistory: { orderBy: { createdAt: "desc" }, take: 20, include: { changedBy: { select: { fullName: true } } } },
      inventoryAdjustments: { orderBy: { createdAt: "desc" }, take: 20, include: { createdBy: { select: { fullName: true } } } },
    },
  });

  if (!product) notFound();

  const [categories, params2] = await Promise.all([
    prisma.productCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    Promise.resolve(await props.searchParams),
  ]);

  const values: ProductFormValues = {
    id: product.id,
    name: product.name,
    brand: product.brand ?? "",
    manufacturer: product.manufacturer,
    strength: product.strength ?? "",
    dosageForm: product.dosageForm,
    packSize: product.packSize,
    packUnit: product.packUnit ?? "",
    sku: product.sku,
    description: product.description ?? "",
    warnings: product.warnings ?? "",
    usageInformation: product.usageInformation ?? "",
    storageInstructions: product.storageInstructions ?? "",
    additionalInfo: product.additionalInfo ?? "",
    mrp: product.mrpInPaise === null ? "" : String(paiseToRupees(product.mrpInPaise)),
    sellingPrice: String(paiseToRupees(product.sellingPriceInPaise)),
    taxPercent: String(Number(product.taxPercent)),
    stockQuantity: String(product.stockQuantity),
    lowStockThreshold: String(product.lowStockThreshold),
    categoryId: product.categoryId,
    prescriptionRequired: product.prescriptionRequired,
    saleEligibility: product.saleEligibility,
    isActive: product.isActive,
  };

  const canWrite = hasPermission(user.role, PERMISSIONS.PRODUCT_WRITE);
  const canPrice = hasPermission(user.role, PERMISSIONS.PRODUCT_PRICE_WRITE);
  const canStock = hasPermission(user.role, PERMISSIONS.PRODUCT_STOCK_WRITE);
  const canImages = hasPermission(user.role, PERMISSIONS.PRODUCT_IMAGE_WRITE);
  const canRestrict = hasPermission(user.role, PERMISSIONS.PRODUCT_LEGAL_RESTRICTION_WRITE);

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/admin/products" className="hover:underline">
          Products
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span className="text-slate-700">{product.sku}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
          <p className="text-sm text-slate-600">
            SKU {product.sku} &middot; {formatINR(product.sellingPriceInPaise)} &middot;{" "}
            {product.stockQuantity - product.reservedQuantity} available
          </p>
        </div>
        {canWrite ? (
          <form action={setProductActiveAction}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="isActive" value={product.isActive ? "false" : "true"} />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {product.isActive ? "Deactivate" : "Activate"}
            </button>
          </form>
        ) : null}
      </header>

      {params2.created ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Product created. Add photos and check the pricing below.
        </p>
      ) : null}

      {product.legalRestriction !== "NONE" ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Legal restriction:</strong>{" "}
          {product.legalRestriction.replace(/_/g, " ").toLowerCase()}. This product is
          not offered on the storefront while the restriction applies.
        </p>
      ) : null}

      <ImageManager
        productId={product.id}
        canManage={canImages}
        images={product.images.map((image) => ({
          id: image.id,
          url: image.url,
          altText: image.altText,
          width: image.width,
          height: image.height,
          isPrimary: image.isPrimary,
          variants: image.variants,
        }))}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Details</h2>
        <div className="mt-4">
          <ProductForm
            action={updateProductAction}
            values={values}
            categories={categories}
            submitLabel="Save product"
            showStock={false}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Pricing</h2>
        <p className="mt-1 text-xs text-slate-500">
          Every price change is recorded with the previous price, the new price,
          the person who made the change and the time.
        </p>
        <div className="mt-4">
          <PriceManager
            productId={product.id}
            sellingPriceRupees={String(paiseToRupees(product.sellingPriceInPaise))}
            mrpRupees={product.mrpInPaise === null ? "" : String(paiseToRupees(product.mrpInPaise))}
            canManage={canPrice}
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Price history</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-4">Previous</th>
                <th scope="col" className="py-2 pr-4">New</th>
                <th scope="col" className="py-2 pr-4">Changed by</th>
                <th scope="col" className="py-2 pr-4">When</th>
                <th scope="col" className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {product.priceHistory.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-2 pr-4 text-slate-600">
                    {formatINR(entry.previousPriceInPaise)}
                  </td>
                  <td className="py-2 pr-4 font-medium text-slate-900">
                    {formatINR(entry.newPriceInPaise)}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {entry.changedBy?.fullName ?? "System"}
                  </td>
                  <td className="py-2 pr-4 text-slate-500">
                    {entry.createdAt.toLocaleString("en-IN")}
                  </td>
                  <td className="py-2 text-slate-500">{entry.reason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Stock</h2>
        <p className="mt-1 text-xs text-slate-500">
          Adjustments are recorded with the reason, the resulting stock level and
          the person who made the change.
        </p>
        <div className="mt-4">
          <StockManager productId={product.id} canManage={canStock} />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Stock history</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-4">Change</th>
                <th scope="col" className="py-2 pr-4">Stock after</th>
                <th scope="col" className="py-2 pr-4">Reason</th>
                <th scope="col" className="py-2 pr-4">By</th>
                <th scope="col" className="py-2">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {product.inventoryAdjustments.map((entry) => (
                <tr key={entry.id}>
                  <td
                    className={`py-2 pr-4 font-medium ${
                      entry.delta >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {entry.delta > 0 ? "+" : ""}
                    {entry.delta}
                  </td>
                  <td className="py-2 pr-4 text-slate-900">{entry.stockAfter}</td>
                  <td className="py-2 pr-4 text-slate-600">{entry.reason.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-4 text-slate-600">
                    {entry.createdBy?.fullName ?? "System"}
                  </td>
                  <td className="py-2 text-slate-500">
                    {entry.createdAt.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Legal restriction</h2>
        <p className="mt-1 text-xs text-slate-500">
          Changing a legal restriction requires a separate permission and is
          written to the audit log.
        </p>
        <div className="mt-4">
          <LegalRestrictionManager
            productId={product.id}
            current={product.legalRestriction}
            note={product.legalRestrictionNote}
            canManage={canRestrict}
          />
        </div>
      </section>
    </div>
  );
}
