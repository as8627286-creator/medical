import "server-only";
import { prisma } from "@/lib/db";
import { LegalRestriction, SaleEligibility } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { evaluateEligibility, type EligibilityInput } from "./eligibility";

/**
 * Catalogue queries.
 *
 * Every storefront query goes through the eligibility rules, so a product that
 * is legally restricted for online sale can never leak into a listing, a
 * search result or a product page.
 */

export interface CatalogueProduct {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  manufacturer: string;
  strength: string | null;
  dosageForm: string;
  packSize: string;
  packUnit: string | null;
  description: string | null;
  warnings: string | null;
  usageInformation: string | null;
  storageInstructions: string | null;
  additionalInfo: string | null;
  mrpInPaise: number | null;
  sellingPriceInPaise: number;
  taxPercent: number;
  taxInPaise: number;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  categoryId: string;
  isActive: boolean;
  prescriptionRequired: boolean;
  saleEligibility: SaleEligibility;
  legalRestriction: LegalRestriction;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogueProductWithRelations extends CatalogueProduct {
  category: { id: string; name: string; slug: string };
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
    width: number;
    height: number;
    isPrimary: boolean;
    variants: unknown;
  }>;
}

// Typed with `satisfies` rather than `as const`: `as const` makes the nested
// `orderBy` array readonly, which Prisma's generated argument types reject.
const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: {
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      url: true,
      altText: true,
      width: true,
      height: true,
      isPrimary: true,
      variants: true,
    },
  },
} satisfies Prisma.ProductInclude;

export function toEligibilityInput(product: {
  isActive: boolean;
  saleEligibility: SaleEligibility;
  legalRestriction: LegalRestriction;
  prescriptionRequired: boolean;
  stockQuantity: number;
  reservedQuantity: number;
}): EligibilityInput {
  return product as unknown as EligibilityInput;
}

/** A catalogue row as returned by Prisma, with its relations included. */
export type CatalogueProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * Normalises a catalogue row into the view model the storefront renders.
 *
 * Prisma returns `taxPercent` as a `Decimal`; the storefront, the pricing
 * helpers and the JSON payloads all work in plain numbers. Converting here
 * keeps the conversion in the layer that owns the catalogue shape, instead of
 * leaving every consumer to cast.
 */
export function toCatalogueProduct(row: CatalogueProductRow): CatalogueProductWithRelations {
  return {
    ...row,
    taxPercent: Number(row.taxPercent),
  };
}

export interface ListProductsOptions {
  q?: string | undefined;
  categorySlug?: string | undefined;
  prescriptionRequired?: boolean | undefined;
  inStockOnly?: boolean | undefined;
  includeInactive?: boolean | undefined;
  sort?: "name_asc" | "name_desc" | "price_asc" | "price_desc" | "newest" | "stock_asc";
  page?: number;
  pageSize?: number;
  /** When true, products that are not sellable online are removed. */
  onlineOnly?: boolean;
}

export async function listProducts(options: ListProductsOptions = {}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));

  const where: Record<string, unknown> = {};

  if (!options.includeInactive) {
    where.isActive = true;
  }

  if (options.categorySlug) {
    where.category = { slug: options.categorySlug };
  }

  if (options.prescriptionRequired !== undefined) {
    where.prescriptionRequired = options.prescriptionRequired;
  }

  if (options.q && options.q.trim()) {
    const term = options.q.trim().toLowerCase();
    where.searchText = { contains: term };
  }

  const orderBy: Record<string, unknown>[] = [];
  switch (options.sort) {
    case "price_asc":
      orderBy.push({ sellingPriceInPaise: "asc" });
      break;
    case "price_desc":
      orderBy.push({ sellingPriceInPaise: "desc" });
      break;
    case "newest":
      orderBy.push({ createdAt: "desc" });
      break;
    case "stock_asc":
      orderBy.push({ stockQuantity: "asc" });
      break;
    case "name_desc":
      orderBy.push({ name: "desc" });
      break;
    default:
      orderBy.push({ name: "asc" });
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  const visible = options.onlineOnly
    ? products.filter((product) =>
        evaluateEligibility(toEligibilityInput(product)).sellableOnline,
      )
    : products;

  return { products: visible.map(toCatalogueProduct), total, page, pageSize };
}

export async function getProductBySlug(slug: string, sku?: string) {
  const product = await prisma.product.findFirst({
    where: sku ? { OR: [{ sku }, { searchText: slug.toLowerCase() }] } : { searchText: slug.toLowerCase() },
    include: productInclude,
  });
  return product ? toCatalogueProduct(product) : null;
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  return product ? toCatalogueProduct(product) : null;
}

export async function getFeaturedProducts(limit = 8) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: limit * 3,
  });
  return products
    .filter((product) => evaluateEligibility(toEligibilityInput(product)).sellableOnline)
    .slice(0, limit)
    .map(toCatalogueProduct);
}

export async function listCategories() {
  return prisma.productCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
}

/** Builds the lowercase search text used by the catalogue search. */
export function buildSearchText(fields: {
  name: string;
  brand?: string | null;
  manufacturer?: string | null;
  strength?: string | null;
  packSize?: string | null;
}): string {
  return [
    fields.name,
    fields.brand,
    fields.manufacturer,
    fields.strength,
    fields.packSize,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .toLowerCase();
}


