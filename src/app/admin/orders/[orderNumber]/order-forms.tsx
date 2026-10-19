"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { OrderStatus } from "@/generated/prisma/enums";
import {
  cancelOrderAction,
  changeOrderStatusAction,
  updateDeliveryAction,
  type AdminOrderState,
} from "../actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

function StatusMessage({ state }: { state: AdminOrderState }) {
  if (state.message) {
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
  const firstError = state.errors ? Object.values(state.errors)[0] : undefined;
  if (firstError) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {firstError}
      </p>
    );
  }
  return null;
}

export function OrderStatusForm({
  orderId,
  transitions,
}: {
  orderId: string;
  transitions: OrderStatus[];
}) {
  const [state, formAction] = useActionState(changeOrderStatusAction, {} as AdminOrderState);

  return (
    <form action={formAction} className="mt-3 space-y-3" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <StatusMessage state={state} />

      <div>
        <label htmlFor="status" className="block text-xs font-medium text-slate-700">
          New status
        </label>
        <select
          id="status"
          name="status"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {transitions.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="note" className="block text-xs font-medium text-slate-700">
          Note (optional)
        </label>
        <input
          id="note"
          name="note"
          type="text"
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <SubmitButton label="Update status" />
    </form>
  );
}

const DELIVERY_STATUSES = [
  "PENDING",
  "PREPARING",
  "DISPATCHED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
];

export function DeliveryForm({
  orderId,
  current,
  zone,
}: {
  orderId: string;
  current: string;
  zone: string | null;
}) {
  const [state, formAction] = useActionState(updateDeliveryAction, {} as AdminOrderState);

  return (
    <form action={formAction} className="mt-3 space-y-3" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <StatusMessage state={state} />

      {zone ? <p className="text-xs text-slate-500">Delivery zone: {zone}</p> : null}

      <div>
        <label htmlFor="delivery-status" className="block text-xs font-medium text-slate-700">
          Delivery status
        </label>
        <select
          id="delivery-status"
          name="status"
          defaultValue={current}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {DELIVERY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="assignedTo" className="block text-xs font-medium text-slate-700">
          Delivery agent (optional)
        </label>
        <input
          id="assignedTo"
          name="assignedTo"
          type="text"
          maxLength={120}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="deliveredToName" className="block text-xs font-medium text-slate-700">
          Delivered to (optional)
        </label>
        <input
          id="deliveredToName"
          name="deliveredToName"
          type="text"
          maxLength={120}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="proofOfDeliveryNote" className="block text-xs font-medium text-slate-700">
          Proof of delivery note (optional)
        </label>
        <input
          id="proofOfDeliveryNote"
          name="proofOfDeliveryNote"
          type="text"
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="failureReason" className="block text-xs font-medium text-slate-700">
          Failure reason (only if the delivery failed)
        </label>
        <input
          id="failureReason"
          name="failureReason"
          type="text"
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <SubmitButton label="Save delivery" />
    </form>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(cancelOrderAction, {} as AdminOrderState);

  return (
    <form action={formAction} className="mt-3 space-y-3" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <StatusMessage state={state} />

      <div>
        <label htmlFor="cancel-reason" className="block text-xs font-medium text-slate-700">
          Reason
        </label>
        <textarea
          id="cancel-reason"
          name="reason"
          rows={2}
          required
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
      >
        Cancel order
      </button>
    </form>
  );
}
