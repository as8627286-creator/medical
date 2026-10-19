import { NextResponse } from "next/server";
import { getStorage, STORAGE_NAMESPACE } from "@/lib/storage";
import { PRODUCT_IMAGE_WIDTHS } from "@/lib/media/image-widths";

/**
 * Media route for product images.
 *
 * Only objects in the `products/` namespace are served. Prescription documents
 * live in a different namespace and are never reachable from here: they are
 * served through the authorised, audited prescription route instead.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(
  _request: Request,
  ctx: RouteContext<"/media/[...path]">,
) {
  const { path } = await ctx.params;
  const segments: string[] = Array.isArray(path) ? path : [path];

  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    return new Response("Not found", { status: 404 });
  }

  const key = segments.join("/");
  if (!key.startsWith(`${STORAGE_NAMESPACE.PRODUCTS}/`)) {
    return new Response("Not found", { status: 404 });
  }

  // Defensive: no traversal, no absolute paths, no control characters.
  if (
    key.includes("..") ||
    key.includes("\0") ||
    key.startsWith("/") ||
    !/^[A-Za-z0-9._/-]+$/.test(key)
  ) {
    return new Response("Not found", { status: 404 });
  }

  const storage = getStorage();
  let object = await storage.get(key);
  let servedKey = key;

  if (!object) {
    // Fall back to the closest smaller generated variant so that a request
    // for a width that was not generated still returns a sensible image.
    const fallback = await findFallbackVariant(storage, key);
    if (fallback) {
      object = await storage.get(fallback);
      servedKey = fallback;
    }
  }

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const extension = servedKey.slice(servedKey.lastIndexOf("."));
  const contentType = CONTENT_TYPES[extension] ?? object.contentType;

  return new NextResponse(new Uint8Array(object.body), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(object.bytes),
      // Images are immutable: the file name changes for every upload.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

/**
 * Finds the closest smaller generated variant of the requested file.
 *
 * The generated widths are known, so a request for a width that does not
 * exist can be served with the next smaller variant instead of a 404.
 */
async function findFallbackVariant(
  storage: { exists(key: string): Promise<boolean> },
  key: string,
): Promise<string | null> {
  const match = /^(.*\/)([0-9]+)\.webp$/.exec(key);
  if (!match) return null;

  const directory = match[1]!;
  const width = Number(match[2]);
  if (!Number.isFinite(width)) return null;

  for (const candidate of [...PRODUCT_IMAGE_WIDTHS].sort((a, b) => b - a)) {
    if (candidate >= width) continue;
    const candidateKey = `${directory}${candidate}.webp`;
    if (await storage.exists(candidateKey)) return candidateKey;
  }

  return null;
}
