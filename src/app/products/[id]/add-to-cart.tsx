"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { addToCartAction, type CartActionState } from "@/app/cart/actions";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
    >
      {pending ? "Adding..." : "Add to cart"}
    </button>
  );
}

export function AddToCart({
  productId,
  maxQuantity,
  signedIn,
}: {
  productId: string;
  maxQuantity: number;
  signedIn: boolean;
}) {
  const [state, formAction] = useActionState(addToCartAction, {} as CartActionState);

  return (
    <form action={formAction} className="mt-6 space-y-3" noValidate>
      <input type="hidden" name="productId" value={productId} />

      {state.message ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.message}{" "}
          <Link href="/cart" className="font-semibold underline">
            View the cart
          </Link>
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="quantity" className="block text-xs font-medium text-slate-700">
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={maxQuantity}
            defaultValue={1}
            className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <AddButton />
        {!signedIn ? (
          <p className="text-xs text-slate-500">
            You will be asked to sign in before the order is placed.
          </p>
        ) : null}
      </div>
    </form>
  );
}
