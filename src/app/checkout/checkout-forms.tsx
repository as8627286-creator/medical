"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { placeOrderAction, saveAddressAction, type CheckoutState } from "./actions";

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Please wait..." : label}
    </button>
  );
}

export function PlaceOrderForm({ disabled, addressId }: { disabled: boolean; addressId: string }) {
  const [state, formAction] = useActionState(placeOrderAction, {} as CheckoutState);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="addressId" value={addressId} />

      {state.errors?.addressId ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.errors.addressId}
        </p>
      ) : null}
      {state.errors?.paymentMethod ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.errors.paymentMethod}
        </p>
      ) : null}

      <div>
        <label htmlFor="customerNote" className="block text-xs font-medium text-slate-700">
          Note for the pharmacy (optional)
        </label>
        <textarea
          id="customerNote"
          name="customerNote"
          rows={2}
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Delivery instructions"
        />
      </div>

      <SubmitButton label="Place order" disabled={disabled} />
    </form>
  );
}

export function AddressForm() {
  const [state, formAction] = useActionState(saveAddressAction, {} as CheckoutState);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2" noValidate>
      {state.message ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:col-span-2">
          {state.message}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <label htmlFor="fullName" className="block text-xs font-medium text-slate-700">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.fullName ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.fullName}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="phone" className="block text-xs font-medium text-slate-700">
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          inputMode="numeric"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.phone ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.phone}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="pincode" className="block text-xs font-medium text-slate-700">
          PIN code
        </label>
        <input
          id="pincode"
          name="pincode"
          inputMode="numeric"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.pincode ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.pincode}
          </p>
        ) : null}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="line1" className="block text-xs font-medium text-slate-700">
          Address
        </label>
        <input
          id="line1"
          name="line1"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.line1 ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.line1}
          </p>
        ) : null}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="line2" className="block text-xs font-medium text-slate-700">
          Flat, building or street (optional)
        </label>
        <input
          id="line2"
          name="line2"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="landmark" className="block text-xs font-medium text-slate-700">
          Landmark (optional)
        </label>
        <input
          id="landmark"
          name="landmark"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="city" className="block text-xs font-medium text-slate-700">
            City
          </label>
          <input
            id="city"
            name="city"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="state" className="block text-xs font-medium text-slate-700">
            State
          </label>
          <input
            id="state"
            name="state"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Save address
        </button>
      </div>
    </form>
  );
}
