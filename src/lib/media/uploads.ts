import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

/**
 * Upload validation and image sanitisation.
 *
 * The uploaded file is treated as fully untrusted:
 *  - the browser supplied MIME type is only a hint,
 *  - the file signature (magic bytes) decides which formats are accepted,
 *  - the image is re-encoded by libvips, which drops metadata and any appended
 *    payload (this is what stops "polyglot" files that are valid as both an
 *    image and a script),
 *  - the stored file name is generated, never derived from the upload.
 */

export type ImageFormat = "jpeg" | "png" | "webp";

export interface DetectedImageType {
  format: ImageFormat;
  mimeType: string;
}

const SIGNATURES: Array<{ format: ImageFormat; mimeType: string; matches: (b: Buffer) => boolean }> = [
  {
    format: "jpeg",
    mimeType: "image/jpeg",
    matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    format: "png",
    mimeType: "image/png",
    matches: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    format: "webp",
    mimeType: "image/webp",
    matches: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export class UploadValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UploadValidationError";
    this.code = code;
  }
}

/** Detects the real type of an uploaded file from its signature. */
export function detectImageType(buffer: Buffer): DetectedImageType | null {
  for (const signature of SIGNATURES) {
    if (signature.matches(buffer)) {
      return { format: signature.format, mimeType: signature.mimeType };
    }
  }
  return null;
}

export interface ProcessedImage {
  /** Generated, collision-free base name. The extension is always `.webp`. */
  baseName: string;
  variants: Array<{ width: number; bytes: Buffer; contentType: string }>;
  width: number;
  height: number;
  primary: { bytes: Buffer; contentType: string };
}

/**
 * Validates, re-encodes and resizes an uploaded product image.
 *
 * `widths` are the generated variants. The largest variant is stored as the
 * "primary" image.
 */
export async function processProductImage(
  file: File,
  options: { maxBytes: number; widths: number[] },
): Promise<ProcessedImage> {
  if (file.size === 0) {
    throw new UploadValidationError("empty_file", "The uploaded file is empty.");
  }
  if (file.size > options.maxBytes) {
    throw new UploadValidationError(
      "file_too_large",
      `The image is larger than the ${Math.round(options.maxBytes / 1024 / 1024)} MB limit.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.length > options.maxBytes) {
    throw new UploadValidationError("file_too_large", "The image is larger than the allowed size.");
  }

  const detected = detectImageType(buffer);
  if (!detected) {
    throw new UploadValidationError(
      "unsupported_type",
      "Only JPEG, PNG and WebP images are accepted.",
    );
  }

  // The browser-declared type must not contradict the actual content. Some
  // clients send "application/octet-stream" for valid images, so that case is
  // tolerated, but a clear contradiction is rejected.
  const declared = (file.type || "").toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== detected.mimeType) {
    throw new UploadValidationError(
      "mime_mismatch",
      "The file content does not match the declared file type.",
    );
  }

  let image: ReturnType<typeof sharp>;
  try {
    image = sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 });
  } catch {
    throw new UploadValidationError("invalid_image", "The file is not a readable image.");
  }

  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new UploadValidationError("invalid_image", "The file is not a readable image.");
  }
  if (metadata.width < 64 || metadata.height < 64) {
    throw new UploadValidationError("too_small", "The image must be at least 64x64 pixels.");
  }

  // Re-encode: strips EXIF/metadata and any payload appended to the file.
  const normalized = sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .toFormat("webp", { quality: 85 });

  const widths = [...new Set(options.widths)].filter((w) => w > 0).sort((a, b) => a - b);
  const baseName = randomUUID();

  const variants: ProcessedImage["variants"] = [];
  let primaryBuffer: Buffer | null = null;

  for (const width of widths) {
    const output = await normalized
      .clone()
      .resize({ width, withoutEnlargement: true })
      .toBuffer();
    variants.push({ width, bytes: output, contentType: "image/webp" });
  }

  if (variants.length === 0) {
    const output = await normalized.toBuffer();
    primaryBuffer = output;
  } else {
    primaryBuffer = variants[variants.length - 1]!.bytes;
  }

  return {
    baseName,
    variants,
    width: metadata.width,
    height: metadata.height,
    primary: { bytes: primaryBuffer, contentType: "image/webp" },
  };
}

export type DocumentType = "pdf" | "jpeg" | "png";

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

export interface ProcessedDocument {
  baseName: string;
  bytes: Buffer;
  contentType: string;
  extension: string;
  sha256: string;
}

/**
 * Validates a prescription document. Unlike images, documents are stored
 * verbatim (so that a pharmacist can read them), but the type is decided by
 * the file signature, not by the browser.
 */
export async function processPrescriptionDocument(
  file: File,
  options: { maxBytes: number },
): Promise<ProcessedDocument> {
  const { createHash } = await import("node:crypto");

  if (file.size === 0) {
    throw new UploadValidationError("empty_file", "The uploaded file is empty.");
  }
  if (file.size > options.maxBytes) {
    throw new UploadValidationError(
      "file_too_large",
      `The file is larger than the ${Math.round(options.maxBytes / 1024 / 1024)} MB limit.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > options.maxBytes) {
    throw new UploadValidationError("file_too_large", "The file is larger than the allowed size.");
  }

  let contentType: string;
  let extension: string;

  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    contentType = "application/pdf";
    extension = "pdf";
  } else {
    const detected = detectImageType(buffer);
    if (!detected) {
      throw new UploadValidationError(
        "unsupported_type",
        "Only PDF, JPEG and PNG prescription files are accepted.",
      );
    }
    contentType = detected.mimeType;
    extension = detected.format === "jpeg" ? "jpg" : detected.format;
  }

  // Reject anything that also carries an executable signature.
  if (buffer.subarray(0, 2).toString("ascii") === "MZ") {
    throw new UploadValidationError("unsupported_type", "Executable files are not accepted.");
  }

  return {
    baseName: randomUUID(),
    bytes: buffer,
    contentType,
    extension,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}
