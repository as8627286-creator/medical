/**
 * The widths at which product photos are generated.
 *
 * One owner for the list: the upload pipeline generates exactly these
 * variants, and the client-side image loader maps a requested width onto them.
 * The two must agree, so the list lives here rather than in an environment
 * variable that only one side could see.
 */
export const PRODUCT_IMAGE_WIDTHS = [320, 640, 1280] as const;

export const PRODUCT_IMAGE_MIME_TYPE = "image/webp";
export const PRODUCT_IMAGE_EXTENSION = ".webp";

/** Returns the generated variant that is closest to the requested width. */
export function closestVariant(width: number): number {
  let best: number = PRODUCT_IMAGE_WIDTHS[0];
  for (const candidate of PRODUCT_IMAGE_WIDTHS) {
    if (Math.abs(candidate - width) < Math.abs(best - width)) {
      best = candidate;
    }
  }
  return best;
}
