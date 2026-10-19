"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { reviewPrescriptionAction, type PrescriptionReviewState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export function ReviewForm({
  requirementId,
  canApprove,
}: {
  requirementId: string;
  canApprove: boolean;
}) {
  const [state, formAction] = useActionState(
    reviewPrescriptionAction,
    {} as PrescriptionReviewState,
  );

  return (
    <form action={formAction} className="mt-3 space-y-3" noValidate>
      <input type="hidden" name="requirementId" value={requirementId} />

      {state.message ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.message}
        </p>
      ) : null}
      {state.errors && Object.values(state.errors)[0] ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {Object.values(state.errors)[0]}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`decision-${requirementId}`} className="block text-xs font-medium text-slate-700">
            Decision
          </label>
          <select
            id={`decision-${requirementId}`}
            name="decision"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="APPROVED">Approve</option>
            <option value="REJECTED">Reject</option>
          </select>
        </div>
        <div>
          <label htmlFor={`validForDays-${requirementId}`} className="block text-xs font-medium text-slate-700">
            Valid for (days, optional)
          </label>
          <input
            id={`validForDays-${requirementId}`}
            name="validForDays"
            type="number"
            min={1}
            max={365}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`reason-${requirementId}`} className="block text-xs font-medium text-slate-700">
          Reason (required when rejecting)
        </label>
        <input
          id={`reason-${requirementId}`}
          name="reason"
          type="text"
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor={`notes-${requirementId}`} className="block text-xs font-medium text-slate-700">
          Reviewer notes
        </label>
        <textarea
          id={`notes-${requirementId}`}
          name="notes"
          rows={2}
          maxLength={1000}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {canApprove ? (
        <SubmitButton label="Record decision" />
      ) : (
        <p className="text-xs text-amber-800">
          You do not have permission to review prescriptions. Ask a pharmacist or
          an administrator.
        </p>
      )}
    </form>
  );
}
