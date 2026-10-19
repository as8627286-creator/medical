"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveZoneAction, updateZoneFeeAction, type ZoneState } from "./actions";

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

export function ZoneForm() {
  const [state, formAction] = useActionState(saveZoneAction, {} as ZoneState);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2" noValidate>
      {state.message ? (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm sm:col-span-2 ${
            state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="name" className="block text-xs font-medium text-slate-700">
          Zone name
        </label>
        <input
          id="name"
          name="name"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.name ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="city" className="block text-xs font-medium text-slate-700">
          City
        </label>
        <input
          id="city"
          name="city"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="deliveryFee" className="block text-xs font-medium text-slate-700">
          Delivery charge (Rs)
        </label>
        <input
          id="deliveryFee"
          name="deliveryFee"
          type="number"
          step="0.01"
          min="0"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.deliveryFeeInPaise ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.deliveryFeeInPaise}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="minOrderAmount" className="block text-xs font-medium text-slate-700">
          Minimum order value (Rs)
        </label>
        <input
          id="minOrderAmount"
          name="minOrderAmount"
          type="number"
          step="0.01"
          min="0"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.minOrderAmountInPaise ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.minOrderAmountInPaise}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="estimatedDaysMin" className="block text-xs font-medium text-slate-700">
          Delivery days (minimum)
        </label>
        <input
          id="estimatedDaysMin"
          name="estimatedDaysMin"
          type="number"
          min="0"
          max="60"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="estimatedDaysMax" className="block text-xs font-medium text-slate-700">
          Delivery days (maximum)
        </label>
        <input
          id="estimatedDaysMax"
          name="estimatedDaysMax"
          type="number"
          min="0"
          max="60"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="pincodes" className="block text-xs font-medium text-slate-700">
          PIN codes (comma or space separated)
        </label>
        <input
          id="pincodes"
          name="pincodes"
          required
          placeholder="560001, 560002"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.pincodes ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.pincodes}
          </p>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked
          className="h-4 w-4 rounded border-slate-300"
        />
        Active
      </label>

      <div className="sm:col-span-2">
        <SubmitButton label="Create zone" />
      </div>
    </form>
  );
}

export function ZoneFeeForm({
  zoneId,
  deliveryFee,
  minOrderAmount,
}: {
  zoneId: string;
  deliveryFee: string;
  minOrderAmount: string;
}) {
  return (
    <form action={updateZoneFeeAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={zoneId} />
      <div>
        <label htmlFor={`fee-${zoneId}`} className="block text-xs font-medium text-slate-700">
          Delivery charge (Rs)
        </label>
        <input
          id={`fee-${zoneId}`}
          name="deliveryFee"
          type="number"
          step="0.01"
          min="0"
          defaultValue={deliveryFee}
          className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor={`min-${zoneId}`} className="block text-xs font-medium text-slate-700">
          Minimum order (Rs)
        </label>
        <input
          id={`min-${zoneId}`}
          name="minOrderAmount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={minOrderAmount}
          className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <SubmitButton label="Update charges" />
    </form>
  );
}
