"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ProductImage } from "@/components/product-image";
import {
  removeProductImageAction,
  setPrimaryImageAction,
  uploadProductImageAction,
  type AdminActionState,
} from "./actions";

interface GalleryImage {
  id: string;
  url: string;
  altText: string | null;
  width: number;
  height: number;
  isPrimary: boolean;
  variants: unknown;
}

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
    >
      {pending ? "Uploading..." : "Upload photo"}
    </button>
  );
}

export function ImageManager({
  productId,
  images,
  canManage,
}: {
  productId: string;
  images: GalleryImage[];
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(uploadProductImageAction, {} as AdminActionState);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Photos</h2>

      {images.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No photos yet. Upload a JPEG, PNG or WebP image of the product.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <li
              key={image.id}
              className={`overflow-hidden rounded-lg border ${
                image.isPrimary ? "border-emerald-600" : "border-slate-200"
              }`}
            >
              <div className="flex h-28 items-center justify-center bg-slate-50">
                <ProductImage
                  src={image.url}
                  alt={image.altText ?? "Product photo"}
                  width={112}
                  height={112}
                  className="h-28 w-28 object-contain p-1"
                />
              </div>
              <div className="space-y-1 p-2">
                {image.isPrimary ? (
                  <p className="text-[11px] font-semibold text-emerald-700">Primary photo</p>
                ) : canManage ? (
                  <form action={setPrimaryImageAction}>
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="imageId" value={image.id} />
                    <button
                      type="submit"
                      className="text-[11px] font-medium text-slate-600 hover:underline"
                    >
                      Make primary
                    </button>
                  </form>
                ) : null}
                {canManage ? (
                  <form action={removeProductImageAction}>
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="imageId" value={image.id} />
                    <button
                      type="submit"
                      className="text-[11px] font-medium text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form action={formAction} className="mt-4 space-y-3" noValidate>
          {state.message ? (
            <p
              role="status"
              className={`rounded-lg px-3 py-2 text-sm ${
                state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
              }`}
            >
              {state.message}
            </p>
          ) : null}
          <div>
            <label htmlFor="photo" className="block text-xs font-medium text-slate-700">
              New photo
            </label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
            />
            <p className="mt-1 text-xs text-slate-500">
              JPEG, PNG or WebP up to 2 MB. Images are re-encoded and resized
              automatically; the uploaded file name is not used.
            </p>
            {state.errors?.photo ? (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {state.errors.photo}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="altText" className="block text-xs font-medium text-slate-700">
              Alt text
            </label>
            <input
              id="altText"
              name="altText"
              type="text"
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Describe the photo for screen readers"
            />
          </div>
          <UploadButton />
        </form>
      ) : null}
    </section>
  );
}
