import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { ProductForm, type ProductFormValues } from "../product-form";
import { createProductAction } from "../actions";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requirePermission(PERMISSIONS.PRODUCT_WRITE);

  const categories = await prisma.productCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const values: ProductFormValues = {
    name: "",
    brand: "",
    manufacturer: "",
    strength: "",
    dosageForm: "TABLET",
    packSize: "",
    packUnit: "",
    sku: "",
    description: "",
    warnings: "",
    usageInformation: "",
    storageInstructions: "",
    additionalInfo: "",
    mrp: "",
    sellingPrice: "",
    taxPercent: "12",
    stockQuantity: "0",
    lowStockThreshold: "10",
    categoryId: categories[0]?.id ?? "",
    prescriptionRequired: false,
    saleEligibility: "ELIGIBLE_FOR_ONLINE_SALE",
    isActive: true,
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/admin/products" className="hover:underline">
          Products
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span className="text-slate-700">New product</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">Add a product</h1>
      <p className="text-sm text-slate-600">
        Enter the details exactly as printed on the pack. Do not add medical
        claims or recommendations.
      </p>

      {categories.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No product categories exist yet. Create a category before adding
          products.
        </p>
      ) : null}

      <ProductForm
        action={createProductAction}
        values={values}
        categories={categories}
        submitLabel="Create product"
      />
    </div>
  );
}
