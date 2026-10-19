import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getCart } from "@/lib/cart";
import { formatINR } from "@/lib/pricing";
import { ProductImage } from "@/components/product-image";
import { setCartItemQuantityAction, removeCartItemAction } from "./actions";

export const metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Your cart</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to see the items in your cart.
        </p>
        <Link
          href="/login?next=%2Fcart"
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const cart = await getCart(user.id);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Your cart is empty</h1>
        <p className="mt-2 text-sm text-slate-600">
          Browse the medicines we stock and add the ones you need.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Browse medicines
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Your cart</h1>
      <p className="mt-1 text-sm text-slate-600">
        {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
      </p>

      {cart.hasUnavailableItems ? (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some items are no longer available for online sale. Please remove them
          to continue to checkout.
        </p>
      ) : null}

      {cart.requiresPrescription ? (
        <p className="mt-4 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Your cart contains medicines that require a prescription. You will be
          asked to upload it during checkout, and a pharmacist will review it
          before the order is dispensed.
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <li
              key={item.itemId}
              className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row"
            >
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                <ProductImage
                  src={item.imageUrl ?? ""}
                  alt={`${item.name} product photo`}
                  width={96}
                  height={96}
                  className="h-24 w-24 object-contain p-1"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-slate-900">
                  <Link href={`/products/${encodeURIComponent(item.productId)}`} className="hover:underline">
                    {item.name}
                  </Link>
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[item.brand, item.strength, item.packSize].filter(Boolean).join(" | ")}
                </p>
                {item.prescriptionRequired ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Prescription required
                  </p>
                ) : null}
                {!item.sellableOnline ? (
                  <p className="mt-1 text-xs font-medium text-red-700">{item.unavailableReason}</p>
                ) : null}

                <form action={setCartItemQuantityAction} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="itemId" value={item.itemId} />
                  <label htmlFor={`qty-${item.itemId}`} className="sr-only">
                    Quantity of {item.name}
                  </label>
                  <input
                    id={`qty-${item.itemId}`}
                    name="quantity"
                    type="number"
                    min={1}
                    max={item.maxQuantity}
                    defaultValue={item.quantity}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Update
                  </button>
                </form>
              </div>

              <div className="flex flex-col items-end justify-between gap-2 sm:w-40">
                <p className="text-sm font-semibold text-slate-900">
                  {formatINR(item.lineTotalInPaise)}
                </p>
                <p className="text-xs text-slate-500">
                  {formatINR(item.unitPriceInPaise)} each
                </p>
                <form action={removeCartItemAction}>
                  <input type="hidden" name="itemId" value={item.itemId} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Subtotal</dt>
              <dd className="font-medium text-slate-900">
                {formatINR(cart.totals.subtotalInPaise)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Delivery (estimated)</dt>
              <dd className="font-medium text-slate-900">
                {formatINR(cart.deliveryFeeInPaise)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
              <dt className="font-semibold text-slate-900">Total</dt>
              <dd className="font-bold text-slate-900">
                {formatINR(cart.totals.subtotalInPaise + cart.deliveryFeeInPaise)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            Delivery charges are confirmed for your PIN code at checkout.
          </p>
          <Link
            href="/checkout"
            className="mt-4 block rounded-lg bg-emerald-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Proceed to checkout
          </Link>
          <Link
            href="/products"
            className="mt-2 block rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
