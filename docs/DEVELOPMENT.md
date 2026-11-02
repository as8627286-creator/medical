# Development

## Requirements

Node.js 22 or newer and npm 10 or newer. The exact versions are pinned in
`.nvmrc` and in `package.json#engines`.

```bash
nvm use        # picks up .nvmrc
npm ci
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on <http://localhost:3000> |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Typecheck and lint |
| `npm run test` | Unit and integration tests (Vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with a coverage report in `coverage/` |
| `npm run db:start` | Start the local PostgreSQL |
| `npm run db:stop` | Stop the local PostgreSQL |
| `npm run db:status` | Report the database state |
| `npm run db:url` | Print the connection URL |
| `npm run db:migrate` | Apply the migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Create a migration from the schema and apply it |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Load the development data |
| `npm run images:import` | Fetch the development product photos (see [PRODUCT_IMAGES.md](PRODUCT_IMAGES.md)) |
| `npm run admin:bootstrap` | Create the first administrator |
| `npm run session:dev` | Print a session token for a user (development only) |

## Environment variables

`src/lib/env.ts` is the only place that reads `process.env`. It validates the
variables once, lazily, and reports the offending variable by name.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | - | PostgreSQL connection string |
| `NODE_ENV` | no | `development` | `development`, `test` or `production` |
| `APP_URL` | no | `http://localhost:3000` | Public address; used for the same-origin check |
| `APP_NAME` | no | `Medical Store` | Display name |
| `SESSION_COOKIE_NAME` | no | `ms_session` | Name of the session cookie |
| `SESSION_TTL_HOURS` | no | `12` | Customer session lifetime |
| `ADMIN_SESSION_TTL_HOURS` | no | `4` | Staff session lifetime |
| `LOGIN_MAX_ATTEMPTS` | no | `5` | Attempts before the account is locked |
| `LOGIN_LOCKOUT_MINUTES` | no | `15` | Lock duration |
| `LOGIN_WINDOW_MINUTES` | no | `15` | Window for the attempt counters |
| `RATE_LIMIT_WINDOW_SECONDS` | no | `60` | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | no | `120` | Requests per window per address |
| `STORAGE_DRIVER` | no | `local` | `local` or `s3` |
| `STORAGE_LOCAL_ROOT` | no | `./storage` | Root of the local storage volume |
| `STORAGE_S3_BUCKET` | with `s3` | - | Bucket name |
| `STORAGE_S3_REGION` | no | `us-east-1` | Region |
| `STORAGE_S3_ENDPOINT` | no | - | Endpoint for MinIO and other S3-compatible stores |
| `STORAGE_S3_ACCESS_KEY_ID` | with `s3` | - | Access key |
| `STORAGE_S3_SECRET_ACCESS_KEY` | with `s3` | - | Secret key |
| `STORAGE_S3_FORCE_PATH_STYLE` | no | `false` | Required by MinIO |
| `MAX_PRODUCT_IMAGE_BYTES` | no | `2097152` | Maximum product photo size (2 MB) |
| `MAX_PRESCRIPTION_BYTES` | no | `10485760` | Maximum prescription size (10 MB) |
| `PAYMENT_PROVIDER` | no | `sandbox` | `sandbox`, `razorpay` or `stripe` |
| `PAYMENT_LIVE` | no | `false` | Allows real money. Keep `false` until the checklist is complete |
| `PAYMENT_WEBHOOK_SECRET` | recommended | - | HMAC secret for webhooks |
| `PAYMENT_RAZORPAY_KEY_ID` | with razorpay | - | Razorpay key |
| `PAYMENT_RAZORPAY_KEY_SECRET` | with razorpay | - | Razorpay secret |
| `PAYMENT_RAZORPAY_WEBHOOK_SECRET` | recommended | - | Razorpay webhook secret |
| `PAYMENT_CURRENCY` | no | `INR` | Currency code |
| `ADMIN_BOOTSTRAP_TOKEN` | no | - | One-time token for a non-interactive bootstrap |

## Project layout

```
prisma/
  schema.prisma          data model
  migrations/            generated SQL migrations
scripts/                 operational commands (bootstrap, seed, maintenance)
src/
  app/
    (storefront routes)  customer-facing pages
    admin/               administration area
    api/                 webhooks, health check, private documents
    media/               public product images
    proxy.ts             security headers and the Content Security Policy
  components/            shared React components
  lib/
    auth/                sessions, password hashing, permissions
    catalogue/           products, eligibility, images
    delivery/            zones, quotes
    media/               upload validation, image processing
    orders/              order placement and cancellation
    payments/            provider interface and adapters
    prescriptions/       the prescription workflow
    storage/             the storage interface and its drivers
    validation/          Zod schemas
tests/
  unit.test.ts           pure rules
  integration/           database-backed behaviour
```

## Conventions

**Server code is the default.** Anything that touches the database, a file or a
secret lives in a module that starts with `import "server-only"`. Client
components import from `src/components` and from shared, side-effect-free
modules such as `src/lib/catalogue/variants.ts`.

**Validate at the boundary.** Every form, query string and JSON body is parsed
by a Zod schema in `src/lib/validation/` before it reaches a service. The
schema is the single definition of what the application accepts.

**Authorise on the server.** A protected page calls `requirePermission`, a
server action or a route handler calls `authorize`. Both resolve the session
and check the permission. Hiding a control in the interface is a usability
feature, not a security control.

**Money in paise.** Convert once at the boundary with `rupeesToPaise`. Never
use floating point for an amount.

**Prices are server-side.** The browser never sends a total. The cart, the
checkout and the order all recompute the amount from the catalogue.

**Every mutation is recorded.** A price change, a stock adjustment, an order
transition and a prescription review all write a history row and an audit
event.

**Errors are typed.** Services throw typed errors (`OrderError`,
`ProductWriteError`, `ImageWriteError`, `PaymentError`,
`PrescriptionError`) with a stable `code`, so that the UI can show a
meaningful message and the tests can assert on behaviour rather than on
strings.

## Changing the schema

```bash
# 1. Edit prisma/schema.prisma
# 2. Create the migration
npm run db:migrate:dev -- --name add_something
# 3. Review the generated SQL
cat prisma/migrations/*/migration.sql
# 4. Apply it to the development database (already done by the previous step)
# 5. Regenerate the client
npm run db:generate
```

In production, migrations are applied with `prisma migrate deploy` during the
deployment. Never run `prisma migrate dev` against a production database, and
never run `prisma db push` against any database that holds data you care
about.

## Working on the catalogue

Product photos are re-encoded at upload time into three widths (320, 640 and
1280 pixels) and stored as WebP. The list of widths lives in
`src/lib/media/image-widths.ts` and is used by both the upload pipeline and
the client-side image loader, so the two cannot drift apart.

## Testing

See [TESTING.md](TESTING.md). The short version:

```bash
npm run test               # everything
npm run test -- unit       # only the unit tests
npm run test -- catalogue  # one integration file
```

The integration tests need a PostgreSQL server. They create and use the
`medical_store_test` database; your development database is never touched.

## Manual verification of a change

1. `npm run check` - typecheck and lint.
2. `npm run test` - the test suites.
3. `npm run dev` and walk through the affected flow in the browser.
4. Check the administration area's **Audit log**: the change must appear
   there for a mutating operation.
