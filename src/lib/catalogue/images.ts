import "server-only";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { recordAudit } from "@/lib/audit";
import { AuditAction } from "@/generated/prisma/enums";
import { getStorage, STORAGE_NAMESPACE, buildKey } from "@/lib/storage";
import { processProductImage, UploadValidationError } from "@/lib/media/uploads";
import { PRODUCT_IMAGE_WIDTHS } from "@/lib/media/image-widths";
import { readVariantKeys, type ProductImageVariant } from "./variants";
import type { Actor } from "./write";

/**
 * Product photo management.
 *
 * Uploaded files are re-encoded (see `lib/media/uploads`), stored under a
 * generated key and never under the name the browser supplied. Product photos
 * live in the `products/` namespace; prescription documents live in a separate
 * namespace and are never reachable through the media route.
 *
 * One upload produces one `ProductImage` row plus one stored file per
 * configured width, so the admin gallery shows one entry per photo.
 */

export class ImageWriteError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ImageWriteError";
    this.code = code;
  }
}

function imageWidths(): number[] {
  return [...PRODUCT_IMAGE_WIDTHS];
}

export async function addProductImage(params: {
  productId: string;
  file: File;
  altText?: string | null;
  actor: Actor;
}): Promise<{ id: string; url: string; variants: ProductImageVariant[] }> {
  const env = getEnv();
  const storage = getStorage();

  const product = await prisma.product.findUnique({ where: { id: params.productId } });
  if (!product) {
    throw new ImageWriteError("not_found", "Product not found.");
  }

  let processed;
  try {
    processed = await processProductImage(params.file, {
      maxBytes: env.MAX_PRODUCT_IMAGE_BYTES,
      widths: imageWidths(),
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      throw new ImageWriteError(error.code, error.message);
    }
    throw error;
  }

  const imageId = crypto.randomUUID();
  const written: string[] = [];
  const variants: ProductImageVariant[] = [];

  try {
    const outputs =
      processed.variants.length > 0
        ? processed.variants
        : [{ width: processed.width, bytes: processed.primary.bytes, contentType: processed.primary.contentType }];

    for (const output of outputs) {
      const key = buildKey(
        STORAGE_NAMESPACE.PRODUCTS,
        params.productId,
        imageId,
        `${output.width}.webp`,
      );
      await storage.put(key, output.bytes, output.contentType);
      written.push(key);
      variants.push({
        width: output.width,
        key,
        bytes: output.bytes.byteLength,
        url: storage.publicUrl(key) ?? `/media/${key}`,
      });
    }
  } catch (error) {
    // Roll back partially written objects so that no orphaned files remain.
    await Promise.all(written.map((key) => storage.delete(key).catch(() => undefined)));
    throw error;
  }

  const primary = variants[variants.length - 1]!;
  const isFirst = (await prisma.productImage.count({ where: { productId: params.productId } })) === 0;
  const maxSort = await prisma.productImage.aggregate({
    where: { productId: params.productId },
    _max: { sortOrder: true },
  });

  const image = await prisma.productImage.create({
    data: {
      productId: params.productId,
      storageKey: primary.key,
      url: primary.url,
      variants: variants as unknown as object,
      width: processed.width,
      height: processed.height,
      bytes: primary.bytes,
      mimeType: "image/webp",
      altText: params.altText ?? `${product.name} - product photo`,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      isPrimary: isFirst,
      createdById: params.actor.id,
    },
  });

  await recordAudit({
    action: AuditAction.PRODUCT_IMAGE_UPLOADED,
    entityType: "Product",
    entityId: params.productId,
    summary: `Photo uploaded for ${product.name} (${product.sku}).`,
    actorId: params.actor.id,
    actorRole: params.actor.role,
    metadata: { sku: product.sku, imageId: image.id, bytes: primary.bytes },
  });

  return { id: image.id, url: image.url, variants };
}

export async function removeProductImage(params: {
  imageId: string;
  actor: Actor;
}): Promise<void> {
  const image = await prisma.productImage.findUnique({
    where: { id: params.imageId },
    include: { product: true },
  });
  if (!image) {
    throw new ImageWriteError("not_found", "Image not found.");
  }

  await prisma.productImage.delete({ where: { id: image.id } });

  const storage = getStorage();
  const variantKeys = readVariantKeys(image.variants);
  await Promise.all(
    [image.storageKey, ...variantKeys].map((key) => storage.delete(key).catch(() => undefined)),
  );
  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { productId: image.productId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }

  await recordAudit({
    action: AuditAction.PRODUCT_IMAGE_REMOVED,
    entityType: "Product",
    entityId: image.productId,
    summary: `Photo removed from ${image.product.name} (${image.product.sku}).`,
    actorId: params.actor.id,
    actorRole: params.actor.role,
    metadata: { sku: image.product.sku, imageId: image.id },
  });
}

export async function setPrimaryImage(params: {
  productId: string;
  imageId: string;
  actor: Actor;
}): Promise<void> {
  const image = await prisma.productImage.findUnique({ where: { id: params.imageId } });
  if (!image || image.productId !== params.productId) {
    throw new ImageWriteError("not_found", "Image not found.");
  }

  await prisma.$transaction([
    prisma.productImage.updateMany({
      where: { productId: params.productId },
      data: { isPrimary: false },
    }),
    prisma.productImage.update({ where: { id: image.id }, data: { isPrimary: true } }),
  ]);
}

/**
 * Re-exported for convenience: the shape of the `variants` column lives in a
 * shared module so that client components can read it without importing this
 * server-only file (which would pull the database client into the browser).
 */
export { readVariantKeys } from "./variants";
