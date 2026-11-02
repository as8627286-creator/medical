/**
 * Imports development product photos from 1mg.com.
 *
 * The development catalogue only contains placeholder products ("Sample
 * Analgesic Tablet", "Demo Brand"), so the generated placeholder photo is
 * replaced by a real pack shot of a comparable medicine. The photo is fetched
 * from a public 1mg.com product page, re-encoded through the ordinary upload
 * pipeline and stored exactly like an administrator upload would be.
 *
 * The photos are third-party product photography. They are development
 * placeholders and must be replaced with the pharmacy's own product
 * photography before the storefront is used for real orders. See
 * `docs/PRODUCT_IMAGES.md`.
 *
 * Usage:
 *   npm run images:import            # fetch and store the photos
 *   npm run images:import -- --dry-run  # fetch and report, store nothing
 *   npm run images:import -- --sku DEMO-ANLG-001  # limit the run
 *
 * The script is idempotent: every run replaces the current photo of the
 * affected products, so it can be repeated after the source images change.
 */

import "dotenv/config";
import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { addProductImage, removeProductImage } from "@/lib/catalogue/images";
import { detectImageType } from "@/lib/media/uploads";
import { recordAudit } from "@/lib/audit";
import { AuditAction } from "@/generated/prisma/enums";

interface SourceEntry {
  sku: string;
  sourceProduct: string;
  sourcePage: string;
  imageUrl: string;
  note: string;
}

interface SourceManifest {
  source: string;
  sourceNotice: string;
  retrievedAt: string;
  products: SourceEntry[];
}

interface ImportOutcome {
  sku: string;
  status: "imported" | "unchanged" | "failed" | "skipped";
  detail: string;
}

const MANIFEST_PATH = path.join(import.meta.dirname, "product-image-sources.json");

/**
 * The image CDN does not need a browser, but it does not serve one either.
 *
 * AVIF is deliberately not advertised: the upload pipeline accepts JPEG, PNG
 * and WebP only, and the CDN would otherwise answer with AVIF for the
 * automatic format transformation.
 */
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  Accept: "image/jpeg,image/png,image/webp",
};

function parseArguments(argv: string[]): { dryRun: boolean; skus: string[] } {
  const dryRun = argv.includes("--dry-run");
  const skus: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--sku") {
      const value = argv[index + 1];
      if (value) skus.push(value);
    }
  }
  return { dryRun, skus };
}

/** Downloads the source photo and returns its bytes and detected media type. */
async function downloadImage(url: string, maxBytes: number): Promise<{
  bytes: Buffer;
  mimeType: string;
  extension: string;
}> {
  const response = await fetch(url, { headers: REQUEST_HEADERS, redirect: "follow" });
  if (!response.ok) {
    throw new Error(`the source answered ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("the source returned an empty body");
  }
  if (bytes.length > maxBytes) {
    throw new Error(`the source image is ${bytes.length} bytes, above the ${maxBytes} byte limit`);
  }
  const detected = detectImageType(bytes);
  if (!detected) {
    throw new Error("the downloaded bytes are not a JPEG, PNG or WebP image");
  }
  return { bytes, mimeType: detected.mimeType, extension: detected.format };
}

/** Finds the account that owns the import in the audit trail. */
async function resolveActor(): Promise<{ id: string; role: string }> {
  const admin = await prisma.user.findFirst({
    where: { isActive: true, role: { code: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: { select: { code: true } } },
  });
  if (!admin) {
    throw new Error(
      "no active administrator account was found; run `npm run admin:bootstrap` before importing photos",
    );
  }
  return { id: admin.id, role: admin.role.code };
}

async function main(): Promise<void> {
  const env = getEnv();
  const { dryRun, skus } = parseArguments(process.argv.slice(2));

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as SourceManifest;
  const entries = skus.length
    ? manifest.products.filter((entry) => skus.includes(entry.sku))
    : manifest.products;

  if (entries.length === 0) {
    throw new Error("no products matched the requested SKUs");
  }

  const actor = await resolveActor();
  const outcomes: ImportOutcome[] = [];

  for (const entry of entries) {
    const product = await prisma.product.findUnique({ where: { sku: entry.sku } });
    if (!product) {
      outcomes.push({
        sku: entry.sku,
        status: "failed",
        detail: "no product with this SKU exists in the catalogue",
      });
      continue;
    }

    let downloaded: Awaited<ReturnType<typeof downloadImage>>;
    try {
      downloaded = await downloadImage(entry.imageUrl, env.MAX_PRODUCT_IMAGE_BYTES);
    } catch (error) {
      outcomes.push({
        sku: entry.sku,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const digest = createHash("sha256").update(downloaded.bytes).digest("hex");
    const altText = `${entry.sourceProduct} - development pack shot from ${manifest.source}`;

    if (dryRun) {
      outcomes.push({
        sku: entry.sku,
        status: "skipped",
        detail: `dry run: fetched ${downloaded.bytes.length} bytes (${downloaded.mimeType}, sha256 ${digest.slice(0, 12)})`,
      });
      continue;
    }

    // The current photo is removed only after the new one has been fetched
    // and validated, so a failed download never leaves a product without a
    // photo.
    const existing = await prisma.productImage.findMany({
      where: { productId: product.id },
      orderBy: { sortOrder: "asc" },
    });
    for (const image of existing) {
      await removeProductImage({ imageId: image.id, actor });
    }

    const file = new File([new Uint8Array(downloaded.bytes)], `import.${downloaded.extension}`, {
      type: downloaded.mimeType,
    });

    try {
      const image = await addProductImage({
        productId: product.id,
        file,
        altText,
        actor,
      });
      await recordAudit({
        action: AuditAction.PRODUCT_IMAGE_UPLOADED,
        entityType: "Product",
        entityId: product.id,
        summary: `Pack shot imported for ${product.name} (${product.sku}) from ${manifest.source}.`,
        actorId: actor.id,
        actorRole: actor.role,
        metadata: {
          sku: product.sku,
          source: manifest.source,
          sourceProduct: entry.sourceProduct,
          sourcePage: entry.sourcePage,
          sourceImage: entry.imageUrl,
          sourceRetrievedAt: manifest.retrievedAt,
          sourceSha256: digest,
          imageId: image.id,
        },
      });
      outcomes.push({
        sku: entry.sku,
        status: "imported",
        detail: `stored ${image.variants.length} variants from ${entry.sourceProduct}`,
      });
    } catch (error) {
      outcomes.push({
        sku: entry.sku,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const outcome of outcomes) {
    const line = `${outcome.sku.padEnd(14)} ${outcome.status.padEnd(9)} ${outcome.detail}`;
    console.log(outcome.status === "failed" ? `FAIL ${line}` : `ok   ${line}`);
  }

  const failures = outcomes.filter((outcome) => outcome.status === "failed");
  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${outcomes.length} photos could not be imported.`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `\n${outcomes.length} photos processed${dryRun ? " (dry run, nothing stored)" : ""}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
