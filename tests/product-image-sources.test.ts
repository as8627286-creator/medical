import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The committed source manifest for the development product photos.
 *
 * The manifest is the only record of where every imported photo came from, so
 * it is checked here rather than trusted: a malformed entry would be imported
 * as a broken or unattributable photo.
 */

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

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(path.join(root, "scripts/product-image-sources.json"), "utf8"),
) as SourceManifest;
const seed = readFileSync(path.join(root, "scripts/seed.ts"), "utf8");

const seededSkus = new Set(
  [...seed.matchAll(/sku:\s*"(DEMO-[A-Z]+-\d+)"/g)].map((match) => match[1]!),
);

describe("product image source manifest", () => {
  it("describes its own source", () => {
    expect(manifest.source).toMatch(/1mg\.com/);
    expect(manifest.sourceNotice).toMatch(/third-party/i);
    expect(manifest.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has an entry for every imported photo", () => {
    expect(manifest.products.length).toBeGreaterThan(0);
    for (const entry of manifest.products) {
      expect(entry.sku).toMatch(/^DEMO-[A-Z]+-\d+$/);
      expect(entry.sourceProduct.length).toBeGreaterThan(0);
      expect(entry.note.length).toBeGreaterThan(0);
    }
  });

  it("maps every product once", () => {
    const skus = manifest.products.map((entry) => entry.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("only refers to products the seed creates", () => {
    for (const entry of manifest.products) {
      expect(seededSkus.has(entry.sku)).toBe(true);
    }
  });

  it("points at 1mg.com product pages over https", () => {
    for (const entry of manifest.products) {
      const url = new URL(entry.sourcePage);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("www.1mg.com");
      expect(url.pathname).toMatch(/^\/(drugs|otc)\//);
    }
  });

  it("points at the 1mg image host over https", () => {
    for (const entry of manifest.products) {
      const url = new URL(entry.imageUrl);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("onemg.gumlet.io");
    }
  });

  it("keeps the 1mg watermark layer so the photo stays attributable", () => {
    for (const entry of manifest.products) {
      expect(entry.imageUrl).toContain("l_watermark_346");
    }
  });
});
