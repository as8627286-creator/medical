"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { uploadPrescriptionAction, type PrescriptionUploadState } from "./prescription-actions";

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
    >
      {pending ? "Uploading..." : "Upload prescription"}
    </button>
  );
}

export function PrescriptionUpload({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(
    uploadPrescriptionAction,
    {} as PrescriptionUploadState,
  );

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="orderId" value={orderId} />

      {state.message ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="prescription" className="block text-xs font-medium text-slate-700">
          Prescription file
        </label>
        <input
          id="prescription"
          name="prescription"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
        />
        <p className="mt-1 text-xs text-slate-500">
          PDF, JPEG or PNG, up to 10 MB. Your document is stored privately and is
          only visible to authorised pharmacy personnel.
        </p>
      </div>

      <UploadButton />
    </form>
  );
}
