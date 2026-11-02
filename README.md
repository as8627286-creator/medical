# Online Medical Store

A web application for a single retail pharmacy in India. Customers browse
eligible medicines, submit orders and choose a payment method; pharmacy staff
manage the catalogue, prices, stock, prescriptions, orders and deliveries from
a protected administration area.

> **Status: development build.**
>
> This application is **not** a statement that the pharmacy is licensed or
> permitted to sell medicines online. Every regulatory question is listed in
> [`docs/PHARMACY_COMPLIANCE_CHECKLIST.md`](docs/PHARMACY_COMPLIANCE_CHECKLIST.md)
> and must be confirmed by qualified personnel and the relevant authorities
> before the storefront accepts real orders. Online ordering and live payments
> are **off by default** and must be switched on deliberately.

---

## What it does

**Storefront**

- Homepage with pharmacy branding, search, categories and featured products
- Search by medicine name, brand, manufacturer and category
- Product cards with photo, name, strength, dosage form, pack size, price and
  availability
- Product pages with the information printed on the pack and its warnings
- Cart with quantity controls, server-side pricing
- Delivery address entry with PIN-code serviceability checks
- Checkout summary with item totals, delivery charge and final price
- Order history and status tracking
- Responsive layouts, accessible forms, clear errors, loading and empty states

**Administration**

- Dashboard: orders, sales, low-stock alerts, pending prescription reviews
- Product create, edit, activate, deactivate, search
- Photo upload with preview, replacement, removal and primary selection
- Price and stock management with full history (previous value, new value,
  actor, timestamp, reason)
- Legal restrictions that cannot be cleared by ordinary product editing
- Order search, filtering, details and status transitions
- Prescription review queue for authorised personnel
- Delivery zones with charges, minimum order values and delivery windows
- Store details, policies and configurable store settings
- Audit log of administrative actions

**Security**

- Server-managed sessions with opaque tokens (only a hash is stored)
- Role-based access control, enforced on the server for every protected action
- Rate limiting and account lock-out on sign-in
- CSRF defence through `SameSite` cookies and same-origin checks
- Upload validation by file signature, re-encoding and generated file names
- Prescription documents in a private namespace, served only through an
  authorised and audited route
- Content Security Policy with a per-request nonce, plus standard security
  headers
- Audit logging that never records passwords, tokens or payment secrets

---

## Technology

| Layer | Choice |
| --- | --- |
| Application | Next.js 16 (App Router) with TypeScript |
| Database | PostgreSQL 16+ with Prisma ORM 7 |
| Styling | Tailwind CSS 4 |
| Authentication | Server-managed sessions (opaque token, hashed in the database) |
| File storage | Local volume or any S3-compatible object store |
| Payments | Provider abstraction: cash on delivery, sandbox, Razorpay adapter |
| Deployment | Docker Compose, Nginx, Let's Encrypt |
| Tests | Vitest (unit + integration), Playwright (end to end) |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the reasoning behind
these choices.

---

## Quick start (development)

Requirements: Node.js 22 or newer (the pinned version is in `.nvmrc`), npm,
and a PostgreSQL server.

```bash
cd /home/adam/myproject/medical-store

# 1. Install the pinned dependencies
npm ci

# 2. Start a local PostgreSQL (downloads the server binaries once, no root
#    required) and print the connection URL
npm run db:start

# 3. Create .env from the template and paste the URL from step 2
cp .env.example .env
#    DATABASE_URL="postgresql://medical_store:medical_store@127.0.0.1:5432/medical_store?schema=public"

# 4. Create the schema and load the development data
npm run db:migrate
npm run db:seed

# 5. Create the first administrator (prompts for the password)
npm run admin:bootstrap -- --email you@example.com --name "Your Name"

# 6. Start the development server
npm run dev
```

Open <http://localhost:3000>. The storefront is at `/`, the administration area
at `/admin`.

The development seed creates three accounts with the password
`DevOnly#Password2026` (override with `SEED_DEV_PASSWORD`):

| Account | Role |
| --- | --- |
| `admin@example.com` | Administrator |
| `pharmacist@example.com` | Pharmacist (may review prescriptions) |
| `customer@example.com` | Customer |

**Remove these accounts before any deployment that is reachable by customers.**

Full instructions, including the Docker-based setup, are in
[`docs/INSTALLATION.md`](docs/INSTALLATION.md).

---

## Documentation

| Document | Contents |
| --- | --- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, data model, request flows, design decisions |
| [INSTALLATION.md](docs/INSTALLATION.md) | Local and Docker installation, first administrator |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Scripts, conventions, day-to-day work |
| [SECURITY.md](docs/SECURITY.md) | Threat model, controls, known limitations |
| [PHARMACY_COMPLIANCE_CHECKLIST.md](docs/PHARMACY_COMPLIANCE_CHECKLIST.md) | The launch gate: what must be confirmed by professionals |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment, HTTPS, hardening, firewall |
| [DEPLOYMENT-FREE-TIER.md](docs/DEPLOYMENT-FREE-TIER.md) | Free-tier deployment (no server, no card), and its limits |
| [BACKUP_AND_RESTORE.md](docs/BACKUP_AND_RESTORE.md) | Backup, restore, migration and rollback |
| [TESTING.md](docs/TESTING.md) | Test strategy, how to run the suites |

---

## Environment variables

Every variable is documented in [`.env.example`](.env.example) and in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md#environment-variables). Secrets are
read only on the server, are never committed to Git and are never sent to the
browser.

---

## Before going live

1. Work through [`docs/PHARMACY_COMPLIANCE_CHECKLIST.md`](docs/PHARMACY_COMPLIANCE_CHECKLIST.md)
   with a qualified pharmacist and, where required, a regulatory adviser.
2. Replace the development catalogue, the placeholder photos and the
   development accounts with real data. The development photos are real pack
   shots from 1mg.com that the pharmacy is not licensed to publish; see
   [`docs/PRODUCT_IMAGES.md`](docs/PRODUCT_IMAGES.md).
3. Set `PAYMENT_LIVE=false` until the payment provider confirms the merchant
   is eligible for pharmacy transactions.
4. Turn on **Accept new orders** in the administration area only after step 1
   is complete.
5. Configure the real delivery zones and the real store policies.
