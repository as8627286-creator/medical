"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  adjustStockAction,
  changePriceAction,
  setLegalRestrictionAction,
  type AdminActionState,
} from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

function StatusMessage({ state }: { state: AdminActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ${
        state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
      }`}
    >
      {state.message}
    </p>
  );
}

const REASONS = [
  "PURCHASE",
  "RETURN",
  "DAMAGE",
  "EXPIRY",
  "CORRECTION",
  "RESERVATION_RELEASE",
  "RECALL",
];

export function StockManager({
  productId,
  canManage,
}: {
  productId: string;
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(adjustStockAction, {} as AdminActionState);

  if (!canManage) return null;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <StatusMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="delta" className="block text-xs font-medium text-slate-700">
            Change in units
          </label>
          <input
            id="delta"
            name="delta"
            type="number"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. 24 or -3"
          />
          {state.errors?.delta ? (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {state.errors.delta}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="reason" className="block text-xs font-medium text-slate-700">
            Reason
          </label>
          <select
            id="reason"
            name="reason"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="note" className="block text-xs font-medium text-slate-700">
            Note
          </label>
          <input
            id="note"
            name="note"
            type="text"
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <SubmitButton label="Apply stock adjustment" />
    </form>
  );
}

export function PriceManager({
  productId,
  sellingPriceRupees,
  mrpRupees,
  canManage,
}: {
  productId: string;
  sellingPriceRupees: string;
  mrpRupees: string;
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(changePriceAction, {} as AdminActionState);

  if (!canManage) return null;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <StatusMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="price-sellingPrice" className="block text-xs font-medium text-slate-700">
            New selling price (Rs)
          </label>
          <input
            id="price-sellingPrice"
            name="sellingPrice"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={sellingPriceRupees}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {state.errors?.sellingPrice ? (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {state.errors.sellingPrice}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="price-mrp" className="block text-xs font-medium text-slate-700">
            MRP (Rs)
          </label>
          <input
            id="price-mrp"
            name="mrp"
            type="number"
            step="0.01"
            min="0"
            defaultValue={mrpRupees}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="price-reason" className="block text-xs font-medium text-slate-700">
            Reason
          </label>
          <input
            id="price-reason"
            name="reason"
            type="text"
            maxLength={300}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Why the price changed"
          />
        </div>
      </div>
      <SubmitButton label="Record price change" />
    </form>
  );
}

const RESTRICTIONS = [
  { value: "NONE", label: "No legal restriction" },
  { value: "PRESCRIPTION_ONLY", label: "Prescription only" },
  { value: "CONTROLLED_SUBSTANCE", label: "Controlled substance" },
  { value: "PROHIBITED_FOR_ONLINE_SALE", label: "Prohibited for online sale" },
  { value: "COLD_CHAIN", label: "Cold chain handling required" },
];

export function LegalRestrictionManager({
  productId,
  current,
  note,
  canManage,
}: {
  productId: string;
  current: string;
  note: string | null;
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(setLegalRestrictionAction, {} as AdminActionState);

  if (!canManage) {
    return (
      <p className="text-sm text-slate-600">
        Legal restriction: <span className="font-medium">{current.replace(/_/g, " ")}</span>
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <StatusMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="legalRestriction" className="block text-xs font-medium text-slate-700">
            Legal restriction
          </label>
          <select
            id="legalRestriction"
            name="legalRestriction"
            defaultValue={current}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {RESTRICTIONS.map((restriction) => (
              <option key={restriction.value} value={restriction.value}>
                {restriction.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="restrictionNote" className="block text-xs font-medium text-slate-700">
            Reason (recorded in the audit log)
          </label>
          <input
            id="restrictionNote"
            name="note"
            type="text"
            required
            maxLength={500}
            defaultValue={note ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {state.errors?.note ? (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {state.errors.note}
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        A product that is prohibited for online sale can never be offered on the
        storefront, whatever the sale-eligibility flag says.
      </p>
      <SubmitButton label="Update legal restriction" />
    </form>
  );
}
