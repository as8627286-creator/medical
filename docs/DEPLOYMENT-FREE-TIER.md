# Free-tier deployment

Target: a public address for the storefront without a server, without a card
and without a paid plan.

**This is a demonstration and training deployment.** Read
[PHARMACY_COMPLIANCE_CHECKLIST.md](PHARMACY_COMPLIANCE_CHECKLIST.md) first. The
procedure below assumes the checklist is complete. If it is not, deploy with
`PAYMENT_LIVE=false` and with **Accept new orders** switched off, so that the
system is available for training without taking real orders.

For a production deployment on a server you control, use
[DEPLOYMENT.md](DEPLOYMENT.md) and `docker-compose.yml` instead. That path has
no sleep, no shared filesystem and no third-party usage limits.

---

## 0. A public address with no account at all

Before creating any account, a public HTTPS address can be had for free with a
Cloudflare quick tunnel. It needs no account, no card and no domain. The
address changes every time the tunnel restarts, and it exists only while the
tunnel runs, so it is a demonstration address and not a home for the store.

```bash
# The application must already be running on port 3000.
cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate
```

The printed address looks like `https://<words>.trycloudflare.com`.

`APP_URL` must be set to that address before the application starts. In
production the same-origin check compares the request host with `APP_URL`, and
a wrong value makes every form submission fail:

```bash
APP_URL="https://<words>.trycloudflare.com" npm run start
```

Restart the application with the new address whenever the tunnel is restarted.

To keep one address for the length of a demonstration, use a named tunnel and
a free `duckdns.org` name instead of a quick tunnel. A named tunnel needs a
free Cloudflare account.

---

## The stack

| Part | Service | Free allowance | Card required |
| --- | --- | --- | --- |
| Application | Render free web service | 512 MB, 750 hours a month | no |
| Database | Neon free plan | 1 GB, 100 projects, no expiry | no |
| Public address | `https://<service>.onrender.com` | unlimited | no |
| Files | Container filesystem (ephemeral) | lost on every deploy | no |

Alternative database: Supabase (500 MB, pauses after a week of inactivity) or
Render's own Postgres (1 GB, **expires 30 days after creation** — not suitable
for a catalogue you want to keep).

Neon is the better choice because it has no expiry and no inactivity pause.

### Why not the other free hosts

| Host | Reason |
| --- | --- |
| Vercel Hobby | The terms restrict the free plan to personal, non-commercial use. A pharmacy storefront is commercial. |
| Koyeb free | A credit card is required since February 2026, with a $29 pre-authorisation hold. |
| Railway free | $1 of credit a month, and a Next.js service costs more than that to run continuously. |
| Cloudflare Pages / Workers | Static hosting and edge functions. A Next.js application with a database and server-side sessions does not run there. |

---

## 1. Put the code on GitHub

Render builds from a repository. The repository must be **private**: the
catalogue, the accounts and the audit log are not public.

```bash
cd /home/adam/myproject/medical-store
git remote add origin git@github.com:<you>/medical-store.git
git push -u origin main
```

Commit the pending work first (`git status` shows changes to the README, the
development documentation, `package.json`, the product card and the new image
import script).

## 2. Create the database

1. Create an account at <https://neon.com> and a project.
2. Choose the region closest to the Render region. `singapore` matches the
   blueprint.
3. Open **Connect** and copy the **pooled** connection string. It looks like:

   ```text
   postgresql://<user>:<password>@ep-xxx-pooler.<region>.aws.neon.tech/<db>?sslmode=require
   ```

   Keep `?sslmode=require`. Neon requires TLS, and the pooled endpoint is the
   one intended for an application that connects and disconnects.

4. Save the string. It is the `DATABASE_URL` of the service.

## 3. Create the service

1. Create an account at <https://render.com> and connect the GitHub
   repository.
2. **New -> Blueprint**, select the repository and apply `render.yaml`.
3. When Render asks for `DATABASE_URL`, paste the Neon connection string.
4. Deploy. The build runs `npm ci`, generates the Prisma client and builds the
   application; the start command applies the migrations and then serves the
   site.

The service is at `https://medical-store.onrender.com` — the name in
`render.yaml` decides the address. If you change the name, change `APP_URL` in
the same file, or every form submission will fail the same-origin check.

Check the deployment:

```bash
curl -fsS https://medical-store.onrender.com/api/health
```

## 4. Create the first administrator

The service shell is not available on the free plan, so run the bootstrap
locally against the same database:

```bash
cd /home/adam/myproject/medical-store
DATABASE_URL="<the Neon connection string>" \
  npm run admin:bootstrap -- --email owner@example.com --name "Owner"
```

The command needs a reachable database and the same environment as the
application. See [DEVELOPMENT.md](DEVELOPMENT.md) for the other commands.

**Remove the development accounts** created by `npm run db:seed`
(`admin@example.com`, `pharmacist@example.com`, `customer@example.com`, all
with the password `DevOnly#Password2026`) before the site is reachable by
customers.

## 5. The public address

The `onrender.com` address is free and immediate. A real name needs one of:

| Option | Cost | Time | Notes |
| --- | --- | --- | --- |
| `eu.org` subdomain | free | days to months | A manual approval by a volunteer run. The name is a subdomain, not a registration. |
| Cloudflare Registrar `.com` | about $8.57 a year | minutes | The honest option for a shop that sells medicines. At-cost pricing, no renewal markup. |
| GitHub Student Pack | free for one year | minutes | Only with an eligible student account. |

To attach a domain on Render: add it under **Settings -> Custom Domains**,
point a `CNAME` record at the service address, and Render issues the
certificate. Update `APP_URL` in `render.yaml` to the new address at the same
time, or the same-origin check will reject every form.

## 6. Files on the free tier

The free plan has **no persistent disk**. Product photos and prescription
documents are written to the container filesystem and are lost on every
deploy, restart or rebuild.

That is acceptable for a demonstration with the catalogue re-seeded on each
deploy, and it is not acceptable for a storefront that takes real orders.

Before real orders:

1. Create a bucket in an S3-compatible store — Cloudflare R2 (10 GB free, a
   card is required to enable it) or Neon Object Storage (5 GB free, no card,
   path-style addressing only).
2. Set the storage variables on the service:

   ```bash
   # For Neon Object Storage
   STORAGE_DRIVER="s3"
   STORAGE_S3_BUCKET="<bucket>"
   STORAGE_S3_REGION="<region>"
   STORAGE_S3_ENDPOINT="<the branch endpoint>"
   STORAGE_S3_ACCESS_KEY_ID="<key id>"
   STORAGE_S3_SECRET_ACCESS_KEY="<secret key>"
   STORAGE_S3_FORCE_PATH_STYLE="true"
   ```

   `STORAGE_S3_FORCE_PATH_STYLE` must be `true` for Neon Object Storage and for
   MinIO. It is `false` for R2.

3. Upload the real product photographs through the administration area, as
   described in [PRODUCT_IMAGES.md](PRODUCT_IMAGES.md). The development
   photographs are third-party pack shots that the pharmacy may not publish.

## 7. What the free tier does not give you

| Limit | Effect | Consequence for the storefront |
| --- | --- | --- |
| The service sleeps after 15 minutes without traffic | The first request after an idle period waits for a cold start of up to a minute | A customer opening the site may see a loading page. Do not switch **Accept new orders** on. |
| No persistent disk | Uploaded files are lost on every deploy | Use S3 storage, or accept that the site is a demonstration. |
| 512 MB of memory | The Prisma pool of 10 connections plus the image pipeline is close to the limit | Upload one product photo at a time. |
| No backups | The database is only as safe as Neon | Enable Neon point-in-time restore, or take your own `pg_dump`. |
| No scheduled jobs | `scripts/maintenance.ts` cannot run on a schedule | Run it by hand, or move it to a paid plan. |
| No shell access | `docker compose exec` is not available | Use the local command line against the same database. |

## 8. Moving to a production host

When the store starts taking real orders, move to
[DEPLOYMENT.md](DEPLOYMENT.md). The differences that matter:

- A server that never sleeps, with the database on the same machine.
- The `uploads` volume, backed up together with the database.
- Nginx with a real rate limit and Let's Encrypt certificates.
- A scheduled maintenance job.

The application code does not change. The difference is the environment:
`DATABASE_URL`, `APP_URL`, `STORAGE_DRIVER` and the storage variables.
