import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getCart } from "@/lib/cart";
import { getStoreSettings } from "@/lib/store/settings";
import { quoteDelivery, paymentMethodEligibility } from "@/lib/delivery/zones";
import { formatINR } from "@/lib/pricing";
import { getEnv } from "@/lib/env";
import { PlaceOrderForm, AddressForm } from "./checkout-forms";

export const metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage(props: {
  searchParams: Promise<{ pincode?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=%2Fcheckout");
  }

  const { pincode } = await props.searchParams;
  const [cart, addresses, settings] = await Promise.all([
    getCart(user.id),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: { isDefault: "desc" } }),
    getStoreSettings(),
  ]);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">There is nothing to check out</h1>
        <p className="mt-2 text-sm text-slate-600">Add a medicine to your cart first.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Browse medicines
        </Link>
      </div>
    );
  }

  const selectedAddress =
    addresses.find((address) => address.pincode === pincode) ??
    addresses.find((address) => address.isDefault) ??
    addresses[0] ??
    null;

  const quote = selectedAddress ? await quoteDelivery(selectedAddress.pincode) : null;

  const subtotal = cart.totals.subtotalInPaise;
  const deliveryFee = quote?.serviceable ? quote.deliveryFeeInPaise : 0;
  const total = subtotal + deliveryFee;

  const env = getEnv();
  const codEligibility = paymentMethodEligibility({
    totalInPaise: total,
    settings: {
      codEnabled: settings.codEnabled,
      codMinOrderAmountInPaise: settings.codMinOrderAmountInPaise,
      codMaxOrderAmountInPaise: settings.codMaxOrderAmountInPaise,
      livePaymentsEnabled: settings.livePaymentsEnabled,
    },
    livePaymentsConfigured: env.PAYMENT_LIVE,
  });

  const onlineAvailable = settings.livePaymentsEnabled && env.PAYMENT_LIVE;
  const belowMinimum =
    quote?.serviceable === true && total < quote.minOrderAmountInPaise;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
      <p className="mt-1 text-sm text-slate-600">
        All amounts are calculated by the pharmacy system when your order is
        placed.
      </p>

      {!settings.salesEnabled ? (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Online ordering is disabled.</strong> The pharmacy has not yet
          confirmed that it may take online medicine orders. Browsing and the
          cart still work.
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">Delivery address</h2>

            {addresses.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Add a delivery address to continue.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {addresses.map((address) => (
                  <li key={address.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                        selectedAddress?.id === address.id
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-slate-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="addressId"
                        value={address.id}
                        defaultChecked={selectedAddress?.id === address.id}
                        className="mt-1 h-4 w-4"
                      />
                      <span className="text-sm">
                        <span className="font-medium text-slate-900">{address.fullName}</span>
                        <span className="block text-slate-600">
                          {address.line1}
                          {address.line2 ? `, ${address.line2}` : ""}, {address.city} -{" "}
                          {address.pincode}
                        </span>
                        <span className="block text-slate-500">Phone: {address.phone}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-emerald-800">
                Add a new address
              </summary>
              <div className="mt-3">
                <AddressForm />
              </div>
            </details>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">Payment method</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="rounded-lg border border-slate-200 p-3">
                <label className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CASH_ON_DELIVERY"
                    defaultChecked
                    disabled={!codEligibility.cashOnDelivery}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="font-medium text-slate-900">Cash on delivery</span>
                    <span className="block text-slate-600">
                      {codEligibility.cashOnDelivery
                        ? "Pay the delivery agent when your order arrives."
                        : codEligibility.reason}
                    </span>
                  </span>
                </label>
              </li>
              <li className="rounded-lg border border-slate-200 p-3">
                <label className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="ONLINE"
                    disabled={!onlineAvailable}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="font-medium text-slate-900">Online payment</span>
                    <span className="block text-slate-600">
                      {onlineAvailable
                        ? "Pay securely by card, UPI or net banking. The payment is confirmed by the pharmacy system, not by your browser."
                        : "Online payment is not available at the moment."}
                    </span>
                  </span>
                </label>
              </li>
            </ul>
          </section>

          {cart.requiresPrescription ? (
            <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Your order contains medicines that require a prescription. You will
              be asked to upload the prescription once the order is placed, and a
              pharmacist will review it before the order is dispensed.
            </p>
          ) : null}
        </div>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Order summary</h2>

          <ul className="mt-4 space-y-2 text-sm">
            {cart.items.map((item) => (
              <li key={item.itemId} className="flex justify-between gap-2">
                <span className="text-slate-600">
                  {item.name} &times; {item.quantity}
                </span>
                <span className="font-medium text-slate-900">
                  {formatINR(item.lineTotalInPaise)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Subtotal</dt>
              <dd className="font-medium text-slate-900">{formatINR(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Delivery charge</dt>
              <dd className="font-medium text-slate-900">{formatINR(deliveryFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
              <dt className="font-semibold text-slate-900">Total</dt>
              <dd className="font-bold text-slate-900">{formatINR(total)}</dd>
            </div>
          </dl>

          {quote ? (
            <p className="mt-2 text-xs text-slate-500">
              {quote.serviceable
                ? `Delivery to ${quote.city ?? "your area"}: ${
                    quote.estimatedWindow ?? "delivery window confirmed at dispatch"
                  }.`
                : quote.reason}
            </p>
          ) : null}

          {belowMinimum ? (
            <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              The minimum order value for this PIN code is{" "}
              {formatINR(quote.minOrderAmountInPaise)}.
            </p>
          ) : null}

          <div className="mt-4">
            <PlaceOrderForm
              disabled={
                !settings.salesEnabled ||
                !selectedAddress ||
                !quote?.serviceable ||
                belowMinimum ||
                !codEligibility.cashOnDelivery
              }
              addressId={selectedAddress?.id ?? ""}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
