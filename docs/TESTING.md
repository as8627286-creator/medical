# Testing

## What is tested, and what is not

| Area | How it is tested | Automated? |
| --- | --- | --- |
| Money arithmetic, sale eligibility, order state machine, image validation | Unit tests over pure functions | Yes |
| Catalogue writes, price history, stock history, image upload validation | Integration tests against PostgreSQL | Yes |
| Order placement, server-side pricing, overselling, prescription gating, cancellation | Integration tests against PostgreSQL | Yes |
| Payments: creation, verification, duplicate webhooks, invalid signatures, cash on delivery | Integration tests against PostgreSQL | Yes |
| Server-side authorisation for every role | Integration test of the guard that the pages and actions call | Yes |
| End-to-end journeys in a browser | Playwright | Yes (see below) |
| Responsive layout and accessibility | Playwright plus a manual pass with a screen reader | Partly |
| Backup and restore | A manual restore drill, documented in `BACKUP_AND_RESTORE.md` | No - it needs a second machine |
| Behaviour of a real payment provider with real credentials | A manual test with the provider's test account | No - it needs a merchant account |
| Regulatory compliance | Not a software property. It is verified by the people named in the compliance checklist | No |

**A simulated provider does not establish real-provider behaviour.** The
sandbox provider behaves like a gateway from the application's point of view
(it signs, it verifies, it rejects duplicates), but it is not Razorpay. The
Razorpay adapter has to be exercised with test credentials before real money
is involved.

## Running the tests

```bash
npm test                       # everything
npm run test:watch             # watch mode
npm run test:coverage          # with a coverage report
npm test -- unit               # one file
npm test -- catalogue          # one integration file
npm test -- -t "oversell"      # one test by name
```

The integration tests need a PostgreSQL server. They create and use the
`medical_store_test` database:

- the database is created if it does not exist,
- the migrations are applied to it,
- every table is truncated between test files,
- **the development database is never touched**.

Point the tests at a different server with `DATABASE_URL`, and change the
database name with `TEST_DATABASE_NAME`.

```bash
DATABASE_URL="postgresql://user:pass@db-host:5432/app" \
TEST_DATABASE_NAME="medical_store_test" \
npm test
```

## The suites

### `tests/unit.test.ts` - pure rules, no database

- money: rupee/paise conversion, tax component of a tax inclusive price,
  line totals, order totals, a total that never goes negative
- sale eligibility: an active product, an inactive product, a product that is
  prohibited for online sale (hidden whatever the flag says), a controlled
  substance, a cold-chain product, a prescription-only product, an
  out-of-stock product, reserved stock, the binding restrictions
- the order state machine: the permitted transitions and the states that
  cannot change
- image variants: the width mapping, the src set, malformed data
- upload validation: the file signature of PNG, JPEG and WebP, and the
  rejection of a file that only claims to be an image

### `tests/integration/catalogue.test.ts` - the catalogue and the photos

- creating a product writes the opening price history and the opening stock
  record
- a duplicate SKU is rejected
- a price change records the previous price, the new price, the actor and the
  timestamp
- a stock adjustment records the delta, the reason, the resulting level and
  the actor
- an adjustment that would make the stock negative is refused
- the search text follows the product fields
- deactivating a product removes it from the storefront
- a file that is not an image is rejected and nothing is stored
- a file whose content contradicts the declared type is rejected
- a valid image is stored under a generated name, not the uploaded one
- a customer has no administrative permission, a pharmacist may review
  prescriptions but not change legal restrictions, an administrator may do
  everything

### `tests/integration/orders.test.ts` - orders, stock and prescriptions

- the order is priced on the server; the browser's numbers are irrelevant
- the order item snapshots the catalogue values, so a later catalogue change
  does not rewrite history
- the cart is emptied when the order is placed
- an address in a PIN code that is not serviceable is refused
- a product that is prohibited for online sale cannot be ordered
- **overselling**: a second order for the last unit is refused and the
  reservation is left at one
- cancelling an order releases the reserved stock and records the reason
- a prescription order is held in `AWAITING_PRESCRIPTION_APPROVAL` and is not
  cleared for dispatch until a pharmacist approves it; the decision, the
  reviewer and the reason are recorded
- a rejected prescription keeps the order on hold
- the delivery quote reports an unserviceable PIN code and uses the zone fee
  and window for a serviceable one

### `tests/integration/payments.test.ts` - payments

- a payment session is created on the server with an amount and an
  idempotency key
- a retry reuses the existing payment instead of creating a second one
- a valid signature captures the payment and confirms the order
- an invalid signature fails the payment and leaves the order unconfirmed
- a payment that was already captured is not captured twice
- a reference that does not match the order does not capture the payment
- a correctly signed webhook is processed
- a replayed webhook is ignored
- a webhook with an invalid signature is rejected and recorded
- cash on delivery stays pending until the collection is confirmed
- a browser claim is not accepted as proof of payment

### `tests/integration/permissions.test.ts` - authorisation

- an unauthenticated request is refused
- a customer is refused every administrative operation
- a pharmacist may review prescriptions and manage the catalogue but may not
  change legal restrictions, write settings or manage users
- an administrator may do everything

## End-to-end tests (Playwright)

The Playwright suite covers the journeys that only exist in the browser.

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

| Spec | Journey |
| --- | --- |
| `e2e/storefront.spec.ts` | Search, open a product, add it to the cart, check the totals |
| `e2e/admin.spec.ts` | Sign in as an administrator, create a product, upload a photo, change a price, adjust the stock, and check the history |
| `e2e/permissions.spec.ts` | A customer is redirected away from the administration area; a prescription document is not reachable without the permission |
| `e2e/accessibility.spec.ts` | Landmarks, labels, focus order, keyboard navigation and the colour contrast of the main screens |

The accessibility spec checks the things that can be automated (labels,
landmarks, contrast, keyboard reachability). A manual pass with a screen
reader is still needed; automation does not find every problem.

## Manual test plan

Run this before every release. It covers the parts that automation cannot.

| # | Check | Expected |
| --- | --- | --- |
| 1 | Sign in with a wrong password | The same message as for an unknown account; the account is locked after the configured number of attempts |
| 2 | Sign in as a customer, then open `/admin` | Redirected to the sign-in page or to the storefront |
| 3 | Open a product page as a signed-out visitor | The page renders; no private data is present in the source |
| 4 | Add a product to the cart, then change its price in the administration area | The cart shows the new price |
| 5 | Set a product to "prohibited for online sale" | It disappears from the storefront and from the search |
| 6 | Upload an executable renamed to `.png` | The upload is rejected with a clear message |
| 7 | Upload a photo and check the file name on disk | A generated name, not the uploaded one |
| 8 | Place an order with a prescription-only product | The order waits for the review and cannot be prepared |
| 9 | Approve the prescription | The order becomes confirmed and may be prepared |
| 10 | Place an order, pay with the sandbox provider, replay the webhook | The order is not changed twice |
| 11 | Open a prescription document without the permission | 403 |
| 12 | Open a prescription document with the permission | The document opens and the access appears in the audit log |
| 13 | Check the response headers | The security headers from `docs/SECURITY.md` are present |
| 14 | Resize the window to 360 px, 768 px and 1440 px | The layout is usable at every width |
| 15 | Navigate the whole storefront with the keyboard only | Every control is reachable and the focus is visible |
| 16 | Read the storefront with a screen reader | The content is announced in a sensible order |

## Dependency checks

```bash
npm audit
npm outdated
```

Record the result of `npm audit` before each release. The known advisories in
the development dependency chain are described in `docs/SECURITY.md`.

## Continuous integration

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: medical_store
          POSTGRES_PASSWORD: medical_store
          POSTGRES_DB: medical_store_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U medical_store"
          --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test
        env:
          DATABASE_URL: postgresql://medical_store:medical_store@localhost:5432/medical_store_test?schema=public
      - run: npm run build
```

The E2E job installs the Playwright browsers with
`npx playwright install --with-deps chromium`.
