# Installation

Two supported paths:

- **A. Local development** - Node.js and a PostgreSQL that runs as your own
  user. Best for development and for reviewing the application.
- **B. Docker** - the same stack that is used in production. Best for a
  server.

The Docker path is the one to use for a real deployment.

## Requirements

| Component | Version | Notes |
| --- | --- | --- |
| Node.js | 22 LTS or newer | The exact version is pinned in `.nvmrc` |
| npm | 10 or newer | Ships with Node.js |
| PostgreSQL | 16 or newer | Only needed for the local (non-Docker) path |
| Docker + Compose | 24 or newer | Only needed for the Docker path |
| OpenSSL | any current | Required by the Prisma query engine |

Check what is installed:

```bash
node --version
npm --version
docker --version
docker compose version
```

## A. Local installation

### 1. Get the code and install the dependencies

```bash
cd /home/adam/myproject/medical-store
npm ci
```

`npm ci` installs exactly the versions in `package-lock.json`. Do not use
`npm install` for a deployment, because it can change the lock file.

### 2. Provide a PostgreSQL database

If a PostgreSQL server is already running, skip this step and use its
connection string.

Otherwise the repository ships a helper that downloads the official
PostgreSQL server binaries and runs them as your own user - no root, no
system packages:

```bash
npm run db:start     # download (once), initialise (once) and start
npm run db:url       # print the connection URL
npm run db:status    # is it running?
npm run db:stop      # stop it
```

The data directory is `~/.local/share/medical-store/pgdata` and the binaries
are cached in `~/.cache/medical-store`.

### 3. Create the environment file

```bash
cp .env.example .env
```

Set at least:

```env
DATABASE_URL="postgresql://medical_store:medical_store@127.0.0.1:5432/medical_store?schema=public"
```

Generate a secret for the payment webhook and for any other signing value:

```bash
openssl rand -hex 32
```

### 4. Create the schema

```bash
npm run db:migrate          # applies every migration (safe to re-run)
# or, when changing the schema:
npm run db:migrate:dev      # creates a new migration from the schema
```

### 5. Load the development data (optional)

```bash
npm run db:seed
```

This creates sample categories, sample products with placeholder photos, a
sample delivery zone, the store settings and three development accounts.
**The products are placeholders with clearly marked sample manufacturers.** The
accounts are for development only.

### 6. Create the first administrator

```bash
npm run admin:bootstrap -- --email you@example.com --name "Your Name"
```

The command asks for the password twice without echoing it. The password must
be at least 12 characters and contain a lowercase letter, an uppercase letter,
a digit and a symbol. There is no default password anywhere in the code.

Useful variants:

```bash
# Generate a strong password and print it once
npm run admin:bootstrap -- --email you@example.com --name "Your Name" --generate

# Non-interactive: the password is piped in
printf '%s' "$PASSWORD" | npm run admin:bootstrap -- --email you@example.com --name "Your Name" --password-stdin
```

### 7. Start the application

```bash
npm run dev
```

The storefront is at <http://localhost:3000> and the administration area at
<http://localhost:3000/admin>.

To try a production build locally:

```bash
npm run build
npm run start
```

## B. Docker installation

### 1. Prepare the environment file

```bash
cp .env.docker.example .env
```

Edit `.env`:

- `POSTGRES_PASSWORD` - a long random password,
- `DATABASE_URL` - use the `db` host name, because that is the service name
  inside the Compose network,
- `APP_URL` - the public address of the site,
- `PAYMENT_WEBHOOK_SECRET` - a long random string,
- `PAYMENT_LIVE=false` and `PAYMENT_PROVIDER=sandbox` until the compliance
  checklist is complete.

### 2. Build and start

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f app
```

The stack contains:

| Service | Purpose | Published port |
| --- | --- | --- |
| `db` | PostgreSQL 16 with a persistent volume | none |
| `app` | The Next.js application | `127.0.0.1:3000` (loopback only) |
| `nginx` | Reverse proxy, TLS and rate limiting | 80, 443 |
| `certbot` | Certificate renewal (runs on demand) | none |

### 3. Apply the migrations

```bash
docker compose exec app npx prisma migrate deploy
```

### 4. Create the first administrator

```bash
docker compose exec app npm run admin:bootstrap -- --email you@example.com --name "Your Name"
```

### 5. Obtain a certificate

See [DEPLOYMENT.md](DEPLOYMENT.md#https-setup) for the full procedure.

## Verifying the installation

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

A healthy installation answers with:

```json
{ "status": "ok", "database": "up", "uptimeSeconds": 42, "latencyMs": 3, "timestamp": "..." }
```

Then:

1. Open the storefront and search for a seeded product.
2. Sign in as the administrator and open **Products**.
3. Upload a photo and check that it appears in the gallery.
4. Change a price and confirm that the price history records the previous
   price, the new price, the actor and the time.
5. Adjust the stock and confirm that the stock history records the reason.
6. Sign in as the customer and add a product to the cart.

## Troubleshooting

**`Can't reach database server`** - the database is not running. Start it with
`npm run db:start` (local) or `docker compose up -d db` (Docker) and check
`npm run db:status`.

**`Invalid environment configuration`** - a required variable is missing or
malformed. The error names the variable. `.env.example` lists every variable
with its purpose.

**`A "use server" file can only export async functions`** - a `"use server"`
module exported a constant or a class. Only async functions may be exported
from such a module; move types and constants to a neighbouring file.

**Port 3000 is already in use** - `npm run dev -- --port 3001`, and update
`APP_URL` to match.
