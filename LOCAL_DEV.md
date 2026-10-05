# Local development — isolated from production

This sets up a local dev environment that cannot reach real production
data: a separate Neon database, local-disk file storage, and an email
"provider" that only logs to the console instead of sending anything.

## 1. Env vars you need to fill in

Two files, kept identical to each other on purpose (see "Why two files"
below): **`.env`** and **`.env.local`**. Both already exist in this repo
with working local-dev values — only the Razorpay keys are placeholders
you may want to replace.

| Variable | Dev value | Notes |
|---|---|---|
| `DATABASE_URL` | your Neon **dev** project's connection string | Already filled in with your dev-project URL. **Never** paste the production string here. |
| `SESSION_SECRET` | a random 64-char hex string | Already filled in (freshly generated). |
| `STORAGE_DRIVER` | `local` | Already set. Files are written to `./storage` on disk — never touches R2. |
| `LOCAL_STORAGE_ROOT` | `./storage` | Already set. |
| `EMAIL_PROVIDER` | `console` | Already set. Logs `[email:stub] <to> <subject>` instead of sending — see the audit below for proof this never calls a real provider. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` | placeholders currently | Fine for everything except actually completing a checkout. To test checkout end-to-end, sign up free at Razorpay, flip to **Test Mode**, and paste real `rzp_test_...` keys. Every other page (products, orders, dashboard, downloads) works without touching these. |
| `RAZORPAY_WEBHOOK_SECRET` | placeholder | Only needed if you're tunneling (ngrok etc.) to test the webhook path specifically — see the main README's step 5. |
| `CRON_SECRET` | already generated | Only used by the cleanup-watermarks cron route; harmless locally. |
| `ORDER_CODE_SECRET` | already generated (dev-only value, already filled in) | Keys the order-code display format (see `lib/utils/orderCode.ts`). Required — there's no default, and a missing value throws rather than silently exposing the raw sequential order number. The dev value here is just for local testing and must never be reused in production. |

### Why two files (`.env` and `.env.local`)

Next.js's `next dev` and the Prisma CLI (`prisma migrate dev`, and
`prisma:seed`, which constructs `PrismaClient` directly) load environment
variables differently:

- **Next.js** (`next dev`/`next build`) auto-loads `.env.local` (highest
  priority) and falls back to `.env`.
- **Prisma CLI** only auto-loads `.env` — it does not know `.env.local`
  exists.

Keeping both files identical is the only way one `DATABASE_URL` value
reliably reaches both the app and the migration/seed tooling. This is
the existing convention in this repo, not something new introduced here.

**`.env.local.dev` is not used by anything.** Neither Next.js nor the
Prisma CLI recognizes that filename — it's a dead file, kept only as a
reference copy (and now gitignored, since it holds a real Neon connection
string). If you edit it expecting an effect, nothing will happen; edit
`.env` and `.env.local` instead.

## 2. First-time setup

```bash
npm install

# Applies the full schema to your empty Neon dev database, creating
# every table fresh (nothing to migrate FROM — it's brand new).
npx prisma migrate dev

# Creates the "founder" store and a creator login.
# Prints the login it created — default creator@frostearth.in / changeme123
# unless you override with SEED_CREATOR_EMAIL / SEED_CREATOR_PASSWORD.
npm run prisma:seed

npm run dev
```

Then:
- Storefront: http://localhost:3000/c/founder (also served at http://localhost:3000/ via the rewrite in `next.config.mjs`)
- Creator dashboard: http://localhost:3000/login

## 3. Isolation audit — can this reach real production data?

Audited directly against the actual code, not "should be fine":

**Database — safe, but only if `.env`/`.env.local` genuinely hold the dev
URL.** Nothing in the code has a hardcoded connection string or a
fallback to any other database; `lib/db/prisma.ts` does nothing but
construct `PrismaClient`, which reads `DATABASE_URL` from the
environment. The only way this reaches production is a human pasting
the production string into `.env`/`.env.local` — there's no code-level
safeguard against that, so double-check the value itself before running
migrations.

**File storage — genuinely sandboxed, confirmed by reading the driver.**
`getStorageService()` (`lib/services/storage/index.ts`) switches on
`STORAGE_DRIVER`, defaulting to `"local"` even if the variable is unset
entirely — it never silently falls back to R2. `LocalFsStorageService`
(the local driver) does pure Node `fs` calls scoped under
`LOCAL_STORAGE_ROOT`, with a path-traversal check on every key — zero
network calls, zero AWS SDK usage. `R2StorageService` is only ever
constructed inside the `"r2"` branch of that one switch statement;
nothing else in the codebase imports or instantiates it.

**Email — genuinely a no-op, confirmed by reading the driver.**
`getEmailService()` (`lib/services/email/index.ts`) switches on
`EMAIL_PROVIDER`, defaulting to `"console"` for anything unset or
unrecognized. `ConsoleEmailService.send()` is one line —
`console.log(...)` and returns `true` — no network call at all.
`ResendEmailService`/`BrevoEmailService` are only ever constructed
inside their own switch branches, same as R2.

**Payments — the one thing that's a real network call, by design.**
There's no local/no-op payment provider — `getPaymentService()` always
constructs `RazorpayPaymentService`, which calls the real Razorpay API.
Isolation from *production* here comes entirely from using **test-mode**
keys (`rzp_test_...`), not from any code path — Razorpay's test/live
split is what keeps this from moving real money, and that split lives
in which keys you paste in, not in this codebase. With the current
placeholder keys, checkout creation fails immediately with a Razorpay
auth error (safe failure, not a silent success against something wrong).
**If you ever paste live keys into a dev env file, checkout would
process real charges** — this is the one part of the setup that isn't
enforced by code, only by which keys you use.

**Found and fixed during this audit:** `.env.local.dev` (which held a
real Neon dev connection string) was not covered by any `.gitignore`
pattern — `.env.*.local` requires the filename to *end* in `.local`,
and `.env.local.dev` ends in `.dev`, so it didn't match. It was
untracked but stageable; a `git add -A` would have picked it up. Now
added explicitly to `.gitignore`. `.env` and `.env.local` themselves
were already correctly ignored.
