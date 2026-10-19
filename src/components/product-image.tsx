import Image from "next/image";

/**
 * Renders a product photo.
 *
 * The photo was already resized at upload time; the custom loader maps the
 * width the browser asks for onto the generated variants. The Next.js image
 * optimiser is not used: it does not forward request headers and refuses to
 * optimise same-host sources on private networks, which is exactly how the
 * media route is reached in development.
 */
export function ProductImage({
  src,
  alt,
  width,
  height,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-slate-100 text-xs font-medium text-slate-400 ${className ?? ""}`}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        No photo
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
    />
  );
}
