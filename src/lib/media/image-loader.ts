"use client";

import type { ImageLoaderProps } from "next/image";
import { closestVariant } from "@/lib/media/image-widths";

/**
 * Custom image loader for product photos.
 *
 * The photos are already resized at upload time, so the loader simply points
 * at the generated variant that matches the width the browser asks for. No
 * image optimisation happens at request time, which keeps the media route
 * cheap and avoids proxying the optimiser through the application.
 */
export default function productImageLoader({ src, width }: ImageLoaderProps): string {
  const target = closestVariant(width);
  return src.replace(/\/\d+\.webp$/, `/${target}.webp`);
}
