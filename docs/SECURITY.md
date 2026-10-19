# Security

This document describes the security controls that are implemented, the
threats they address, and the limitations that a reader should know about.

It is a description of the software. It is **not** an assessment of the
pharmacy's regulatory position; see
[PHARMACY_COMPLIANCE_CHECKLIST.md](PHARMACY_COMPLIANCE_CHECKLIST.md).

## 1. Threat model

| Threat | Control |
| --- | --- |
| Credential stuffing against the sign-in form | Per-IP and per-account rate limits, database-backed account lock-out, uniform error message, constant-ish time for the "unknown account" path |
| Session theft through a copied cookie | Opaque 256-bit token, only its SHA-256 hash is stored, `HttpOnly` + `SameSite=Lax` + `Secure` in production, short staff session lifetime, revocable |
| Privilege escalation through a hidden control | Every protected operation calls `authorize()`/`requirePermission()` on the server |
| SQL injection | Prisma parameterises every query; no string-built SQL in the application |
| Cross-site scripting | React escapes by default, a nonce-based Content Security Policy forbids inline scripts, input is validated and never rendered as raw HTML |
| Cross-site request forgery | `SameSite=Lax` session cookie, Next.js Server Action origin checks, and an explicit same-origin check on the JSON API |
| Price or total manipulation | All prices, fees and totals are computed on the server from the catalogue; the browser never sends an amount |
| Overselling | Stock is reserved inside the transaction that creates the order, with a conditional update that fails when the expected value has changed |
| Duplicate or forged payment | Payments are verified on the server, the captured amount is compared with the order, webhooks are signature-checked and processed idempotently |
| Malicious file upload | File signature validation, re-encoding, generated storage names, namespace and path checks, size limits |
| Access to a prescription by a customer or by the public | Private storage namespace, an authorised route that requires a permission, no public URL, every access recorded in the audit log |
| Secrets leaking into the browser or into Git | `server-only` guards, a single validated environment module, `.env` ignored by Git, no secret in a client component |
| Tampering with an order in transit | Order state transitions are restricted to a fixed map; every transition is audited |

## 2. Authentication

**Sessions.** A session is an opaque random token (32 bytes) that the browser
holds in an `HttpOnly` cookie. The database stores only
`SHA-256(token)`, so a database dump does not yield usable sessions. A
session row records the user, the expiry, the creation time, the last-seen
time and the address and user agent of the client that created it.

Expiry is enforced on every read; an expired session is deleted when it is
encountered. `revokeAllSessions` invalidates every session of a user and is
used after a password change and a role change. `sessionsValidFrom` on the
user row supports a "log out everywhere" without deleting the rows.

**Passwords.** Node's built-in scrypt (N=16384, r=8, p=1, 64-byte key,
16-byte random salt). The parameters are stored inside the hash so they can
be raised later without invalidating existing hashes. The comparison uses
`timingSafeEqual`. A password that does not exist still performs a hash, so
the response time does not reveal whether an account exists.

**Policy.** At least 12 characters with an uppercase letter, a lowercase
letter, a digit and a symbol.

**Brute force.** Two layers: an in-process rate limit per address, and a
database-backed per-account counter with a lock-out. The database-backed part
survives a restart and works across instances.

## 3. Authorisation

Permissions are strings on the role row. `lib/auth/rbac.ts` holds the
constants; `lib/auth/guards.ts` holds the guards:

| Guard | Used by |
| --- | --- |
| `requireUser()` | Customer pages that need a session |
| `requireStaff()` | The administration layout |
| `requirePermission(permission)` | Administration pages |
| `authorize(permission)` | Server actions and route handlers (throws a 403 instead of redirecting) |
| `authorizeStaff()` | Staff-only route handlers |

Two rules are enforced in code and not only in the interface:

- **Legal restrictions cannot be cleared by ordinary product editing.** The
  `legalRestriction` field is not part of the product form. It has its own
  permission, its own action and its own audit entry, and
  `evaluateEligibility` refuses to sell a prohibited, controlled or
  cold-chain product whatever the sale-eligibility flag says.
- **A prescription-gated order cannot be dispatched before the review is
  complete.** `orderIsClearedForDispatch` checks every prescription-required
  item of the order, and the order status action refuses the transition.

## 4. Input validation

Every input is parsed by a Zod schema before it reaches a service. The
schemas live in `src/lib/validation/` and are the single definition of what
the application accepts. Numbers arrive as strings from forms and are
converted once, at the boundary.

`formValue`, `formNumber`, `formCheckbox` and `formFile` read a `FormData`
into a plain object; a missing field becomes an empty string and a file that
was not chosen becomes `null`.

The database is never addressed with string-built SQL. Prisma parameterises
every query.

## 5. Output handling

React escapes interpolated values by default, and the application never uses
`dangerouslySetInnerHTML`. The Content Security Policy forbids inline scripts
and any script from an origin that is not the application's own, so an
injected `<script>` cannot execute even if it reached the page.

Security headers, set in `src/proxy.ts` and in `next.config.ts`:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | nonce-based, `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone and geolocation disabled |
| `Strict-Transport-Security` | two years, production only |
| `Cross-Origin-Opener-Policy` | `same-origin` |

## 6. File handling

**Product photos.** The declared MIME type is only a hint; the file signature
decides. JPEG, PNG and WebP are accepted. The image is re-encoded with
libvips, which strips the metadata and removes a payload appended to the
file. The result is stored as WebP at three widths under a generated name
(`<productId>/<uuid>/<width>.webp`). The uploaded file name is never used.

**Prescription documents.** PDF, JPEG and PNG are accepted, up to 10 MB, and
stored verbatim (a pharmacist has to be able to read them). They live in the
`prescriptions/` namespace. The public media route refuses any key outside
the `products/` namespace, and the storage driver rejects any key that
escapes the storage root.

**Serving a prescription.** `/api/admin/prescriptions/[documentId]` requires
the `prescription:read` permission, records the access in the audit log and
returns the document with `Cache-Control: private, no-store` and
`Content-Security-Policy: default-src 'none'; sandbox`.

**Retention.** A prescription document gets a `retentionExpiresAt` three years
in the future. The retention period has to be confirmed against the
applicable record-keeping rules before the deployment goes live.

## 7. Payments

- The payment is created on the server with a server-generated idempotency
  key; a retry reuses the existing payment instead of creating a second one.
- The browser's redirect is a hint. The server calls the provider and only
  trusts the provider's answer.
- The captured amount is compared with the amount owed. A mismatch is
  rejected and the payment is not captured.
- Webhooks are read as raw bytes, signature-checked and processed
  idempotently: the provider event id is unique per provider, so a replayed
  delivery changes nothing.
- An invalid signature is recorded as `REJECTED` and answered with 400.
- Cash on delivery stays `PENDING` until staff record the collection.
- No card data is stored. The application only stores the provider's
  references and the status.

The default provider is the built-in sandbox, which never moves money.
Live payments require `PAYMENT_LIVE=true` **and** the store setting
"Allow live online payments", and both must be turned on deliberately.

## 8. Secrets

- Every secret comes from the environment through `src/lib/env.ts`.
- Modules that read secrets start with `import "server-only"`, so the
  bundler refuses to include them in a client bundle.
- `.env` is ignored by Git; `.env.example` contains placeholders only.
- The audit log redacts keys such as `password`, `token`, `secret`,
  `signature` and `card`, and never records a password or a session token.
- The bootstrap command reads the password from the terminal and pipes it to
  the script over standard input, so it never appears in the process list.

## 9. Logging

Application logs are structured JSON (`level`, `event`, plus event-specific
fields). Audit events are stored in the database, separately from the
operational logs, with the actor, the action, the entity, the address and the
user agent.

## 10. Known limitations

These are real and are not worked around by the code:

1. **The rate limiter is in-process.** With more than one application
   instance, the per-address limit is per instance. The per-account lock is in
   the database and is not affected. Use a shared store or an upstream
   limiter for a multi-instance deployment.
2. **The Content Security Policy allows `'unsafe-inline'` for style
   attributes.** Inline scripts are still forbidden by the nonce. Style
   attributes are a much smaller risk, but a stricter policy would need the
   application to avoid inline styles entirely.
3. **The Razorpay adapter is unverified against a live account.** It is inert
   unless it is explicitly configured. Verify it with test credentials before
   it is used with real money.
4. **No second factor for administrators.** Strong passwords, short staff
   sessions, lock-out and audit logging are implemented. Multi-factor
   authentication is not.
5. **The audit log can be changed by an administrator.** The log is not
   tamper-evident. Export it to write-once storage if the record-keeping
   rules require it.
6. **Dependency advisories.** `npm audit` currently reports advisories in the
   `braces` package, which reaches the application only through
   `eslint-config-next` (a development dependency that is not present in the
   runtime image). No fixed version has been published upstream. Re-run
   `npm audit` before every deployment and record the result.

## 11. Reporting a vulnerability

Report it to the pharmacy owner and to the maintainer of this repository. Do
not include customer data, prescription documents or credentials in the
report.
