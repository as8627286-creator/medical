/**
 * The shape of the `ProductImage.variants` JSON column.
 *
 * A stored product photo produces one entry per generated width:
 * `[{ "width": 640, "key": "products/...", "bytes": 1234, "url": "/media/..." }]`.
 *
 * This module is imported by server code (`lib/catalogue/images`) *and* by
 * client components (`components/product-image`). It therefore must not import
 * anything server-only: no Prisma, no storage driver, no `server-only` guard.
 * A client component that imported the server module would pull the database
 * client into the browser bundle.
 */

export interface ProductImageVariant {
  width: number;
  key: string;
  bytes: number;
  url: string;
}

/** Reads the storage keys of the generated variants, ignoring malformed entries. */
export function readVariantKeys(variants: unknown): string[] {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((variant) => {
      if (variant && typeof variant === "object" && "key" in variant) {
        const key = (variant as { key?: unknown }).key;
        return typeof key === "string" ? key : null;
      }
      return null;
    })
    .filter((key): key is string => Boolean(key));
}

/** Reads the variants of a stored image, keeping only well-formed entries. */
export function parseVariants(value: unknown): ProductImageVariant[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (variant): variant is ProductImageVariant =>
      Boolean(
        variant &&
          typeof variant === "object" &&
          typeof (variant as { width?: unknown }).width === "number" &&
          typeof (variant as { url?: unknown }).url === "string",
      ),
  );
}

/** Builds a `srcSet` from the generated variants. */
export function buildSrcSet(variants: ProductImageVariant[]): string | undefined {
  if (variants.length === 0) return undefined;
  return [...variants]
    .sort((a, b) => a.width - b.width)
    .map((variant) => `${variant.url} ${variant.width}w`)
    .join(", ");
}
