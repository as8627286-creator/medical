# Architecture

This document describes how the application is put together, why, and where
the boundaries are.

## 1. Shape of the system

The application is a **modular monolith**: one Next.js application that owns
the storefront, the administration area and the HTTP API, backed by one
PostgreSQL database and one file store.

```
                       ┌───────────────────────────────┐
  Browser ─── HTTPS ──▶│ Nginx (TLS, rate limiting)    │
                       └──────────────┬────────────────┘
                                      │
                       ┌──────────────▼────────────────┐
                       │ Next.js 16 (App Router)        │
                       │                               │
                       │  app/(storefront)  customer   │
                       │  app/admin         staff      │
                       │  app/api           webhooks   │
                       │  app/media         images     │
                       │                               │
                       │  lib/  domain + services      │
                       └──────┬──────────────┬─────────┘
                              │              │
                   ┌──────────▼───┐   ┌──────▼─────────┐
                   │  PostgreSQL  │   │ File storage   │
                   │  (Prisma)    │   │ local or S3    │
                   └──────────────┘   └────────────────┘
```

No separate services are used. The only network dependency beyond the
database is the file store, and that can be a local volume. Splitting the
application into microservices would add deployment, network and consistency
problems without a technical requirement that needs them.

## 2. Layers

Dependencies point inwards. A layer may use the layers below it, never the
other way round.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain | `src/lib/catalogue/eligibility.ts`, `src/lib/pricing.ts`, `src/lib/validation/` | Pure rules: who may buy what, how money is calculated, what input is acceptable |
| Services | `src/lib/catalogue/write.ts`, `src/lib/orders/service.ts`, `src/lib/payments/service.ts`, `src/lib/prescriptions/service.ts` | Business operations, transactions, audit |
| Adapters | `src/lib/db.ts`, `src/lib/storage/`, `src/lib/payments/sandbox.ts`, `src/lib/payments/razorpay.ts` | Technology-specific implementations behind an interface |
| Application (HTTP) | `src/app/**` | Pages, route handlers, server actions, authorisation guards |

Two rules are enforced by convention and by review:

- **The domain layer has no framework imports.** `eligibility.ts` and
  `pricing.ts` are plain functions over plain data, which is why they can be
  unit tested without a database or a browser.
- **Adapters do not contain business rules.** The payment adapters translate
  between the provider's format and the application's format; the decision to
  capture a payment lives in `lib/payments/service.ts`.

## 3. Rendering model

`cacheComponents` is **disabled** in `next.config.ts`.

The reason is freshness. Almost every page in this application depends on
live state: the session of the visitor, the current price of a product, the
stock that is still available, the state of an order. The Cache Components
model makes those reads a compile-time concern (a `Suspense` boundary or a
`use cache` directive must be present, or the build fails), and it introduces
a class of "stale but cached" price and stock bugs that a pharmacy cannot
afford. The classic dynamic rendering model used by Next.js 16 without Cache
Components makes the rule explicit and simple:

- pages that show prices, stock or session state are `export const dynamic =
  "force-dynamic"`,
- pages that are pure reference material (policies, contact) are dynamic too,
  because they show store settings that an administrator can change at any
  time,
- no page is prerendered, so there is no stale build artefact to invalidate.

`partialPrefetching` is disabled for the same reason: it requires
`cacheComponents`.

The nonce-based Content Security Policy in `src/proxy.ts` also forces dynamic
rendering, which is consistent with the rest of the model.

## 4. Request lifecycle

### 4.1 Storefront page

1. Nginx terminates TLS, applies rate limits and forwards the request with
   the `X-Forwarded-*` headers.
2. `src/proxy.ts` generates a nonce, builds the Content Security Policy and
   the security headers, and forwards the request.
3. The page is a React Server Component. It reads the session cookie through
   `lib/auth/session.ts`, which looks the opaque token up in the database by
   its SHA-256 hash.
4. The page calls a service in `lib/`, which queries Prisma.
5. The response is streamed to the browser. No secret ever reaches the client:
   the session token lives only in an `HttpOnly` cookie.

### 4.2 Protected administration action

1. The user submits a form. Next.js posts it to a Server Action.
2. The action calls `authorize(permission)` from `lib/auth/guards.ts`, which
   resolves the session and checks the permission on the role.
3. The action validates the input with a Zod schema.
4. The action performs the write inside a database transaction, writes the
   history row and writes the audit event.
5. The action revalidates the affected paths and returns a result to the form.

The client-side hiding of a button is never the control. The guard runs in
the action itself, and again in the route handler where a route handler is
used.

### 4.3 Payment webhook

1. The provider posts to `/api/webhooks/payment/[provider]`.
2. The handler reads the **raw** body (the signature is computed over the
   exact bytes) and passes it to the provider adapter.
3. The adapter authenticates the signature. An invalid signature is recorded
   as `REJECTED` and answered with 400.
4. The event id is unique per provider. A replayed event is recorded as a
   duplicate and changes nothing.
5. The payment status is updated and the order is confirmed only when the
   provider says the money was captured.

## 5. Data model

The schema is in `prisma/schema.prisma`. The important decisions:

- **Money is stored as integer paise.** No floating point is used for
  monetary values. Prices are tax inclusive (MRP), which is the normal retail
  model for medicines in India; the tax component is derived for reporting.
- **Order items are snapshots.** `productName`, `productSku`,
  `unitPriceInPaise`, `taxPercent` and the pack description are copied onto
  the order item, so a catalogue change never rewrites history.
- **History is append-only.** `PriceHistory` and `InventoryAdjustment` record
  the previous and the new value, the actor and the timestamp. The current
  value stays on the product row for fast reads.
- **Legal restrictions are separate from the product editor.** The
  `legalRestriction` field is not part of the product form, requires its own
  permission and is always audited. `evaluateEligibility` refuses to sell a
  restricted product whatever the sale-eligibility flag says.
- **Stock has two counters.** `stockQuantity` is what is on the shelf,
  `reservedQuantity` is what is promised to open orders. The available
  quantity is the difference, and the reservation is taken in the same
  transaction that creates the order.
- **Sessions are opaque.** The database stores only the SHA-256 hash of the
  session token, so a database leak does not produce usable sessions.
- **Prescription documents are private.** They live in the `prescriptions/`
  storage namespace, are never served by the public media route and are only
  reachable through an authorised route that records the access.

## 6. File handling

Uploads are treated as hostile input.

1. The declared MIME type is only a hint.
2. The file signature decides the type. Executables and shell scripts are
   rejected.
3. Images are re-encoded with libvips, which strips metadata and removes any
   payload appended to the file. The stored file is WebP at three widths.
4. The stored name is generated (`<uuid>/<width>.webp`). The uploaded name is
   never used, so it cannot contain a path or an executable extension.
5. The storage key is checked against the namespace and the storage root
   before every read and write.

## 7. Payments

`lib/payments/provider.ts` defines the interface. Three implementations exist:

| Provider | When it is used |
| --- | --- |
| `CashOnDeliveryProvider` | Cash on delivery. The payment stays `PENDING` until staff confirm the collection. |
| `SandboxPaymentProvider` | The default in every non-production configuration. Deterministic, HMAC-signed, no money moves. |
| `RazorpayPaymentProvider` | Only when `PAYMENT_PROVIDER=razorpay` **and** credentials are present. Live mode additionally requires `PAYMENT_LIVE=true`. |

The rules that hold for every provider:

- the payment is created on the server with a server-generated idempotency
  key,
- the browser's claim that a payment succeeded is never accepted as proof; the
  server verifies the payment,
- the captured amount is compared with the amount owed,
- webhooks are authenticated and processed idempotently.

## 8. Authorisation model

| Role | Permissions |
| --- | --- |
| `CUSTOMER` | None administrative. Browsing, cart, checkout, own orders, own prescriptions |
| `PHARMACIST` | Catalogue, pricing, stock, orders, delivery, **prescription review**, audit read |
| `ADMIN` | Everything, including legal restrictions, settings and user management |

Permissions are strings stored on the role row, so a new role can be created
without a code change. The constants in `lib/auth/rbac.ts` keep call sites
typo-proof.

Two rules are enforced in the code and not only in the interface:

- a prescription-required order cannot be prepared or dispatched until every
  prescription requirement for that order is approved and still valid
  (`orderIsClearedForDispatch`),
- a legal restriction cannot be removed through the product editor.

## 9. Background work

There is no job runner. The few maintenance tasks are idempotent commands
that can be run from cron:

| Command | Task |
| --- | --- |
| `scripts/maintenance.ts` | Expire stale prescriptions, prune expired sessions and rate-limit buckets |

The alternative - a queue, a worker process, a scheduler - would add a
component that has to be monitored, backed up and secured for a handful of
tasks that run once a day.

## 10. Known limitations

- **The rate limiter is in-process.** With more than one application instance
  the limit is per instance. A shared store (Redis) or an upstream limiter is
  required for a multi-instance deployment. The per-account sign-in lock is
  stored in the database and works across instances.
- **The Razorpay adapter has not been exercised against a live merchant
  account.** It implements the documented flow and stays inert unless it is
  explicitly configured, but it must be verified with test credentials before
  it is used.
- **Order cancellation does not refund an online payment automatically.** The
  refund path exists (`refundPayment`) but the automatic link between a
  cancellation and a refund is not wired up, because the refund policy has to
  be confirmed first.
- **Delivery zones do not support overlapping PIN codes.** A unique constraint
  on the PIN code enforces one zone per PIN code; overlapping zones would
  need a different model.
