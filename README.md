# FrostEarth — MVP

A single-creator (architecturally multi-tenant-ready) digital-product storefront:
PDF upload, public product pages, Razorpay UPI checkout, and secure post-payment download.

## What's actually wired up (no mocks)

- Real Postgres schema via Prisma, every business table carries `storeId`
- Real bcrypt-hashed password auth with signed JWT session cookies, with
  failed-login rate limiting (5 per email / 20 per IP per 15 minutes)
- File storage behind a `StorageService` interface: Cloudflare R2 in
  production (`STORAGE_DRIVER="r2"`, direct-to-R2 presigned uploads),
  local disk for development
- Real Razorpay order creation, checkout, and **webhook signature
  verification** (never trusts the client-side redirect alone)
- Real download tokens: 3-day expiry, 20 uses, only issued after a
  verified payment
- Every download is **watermarked on the fly** with the buyer's name,
  email, phone and order number (visible tiles + PDF metadata; free items
  get metadata only). Latin, Tamil and Devanagari names are supported via
  bundled Noto fonts; nothing watermarked is ever stored.
- Receipt emails via Resend or Brevo (`EMAIL_PROVIDER`), with every send
  logged to `EmailDelivery`; `console` logs instead of sending
- Homepage exam-countdown carousel and notice board, managed from the
  dashboard
- Skill-based quizzes: draft → live → closed, public entry form, score
  computed server-side, entries ranked by score then time. A live quiz is
  only shown and accepts entries between its start and end times.
- Maintenance mode (`MAINTENANCE_MODE="true"`) — see `middleware.ts`

## Setup

> Setting up a local dev environment isolated from production data
> (separate Neon dev database, local file storage, no real emails)?
> See [LOCAL_DEV.md](./LOCAL_DEV.md) — it also covers exactly why
> `.env` and `.env.local` need to stay in sync.

1. **Postgres** — have a running instance (local, Docker, Supabase, Neon, whatever).
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL`
   - `SESSION_SECRET` — any long random string (`openssl rand -hex 32`)
   - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — from your Razorpay **test mode** dashboard
   - `RAZORPAY_WEBHOOK_SECRET` — set this same value when you create the webhook (step 5)
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID` — same as `RAZORPAY_KEY_ID`
3. Install and migrate:
   ```bash
   npm install
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```
   The seed script prints the creator login it just created
   (override with `SEED_CREATOR_EMAIL` / `SEED_CREATOR_PASSWORD` env vars before seeding).
4. ```bash
   npm run dev
   ```
   - Storefront: http://localhost:3000/c/founder
   - Creator login: http://localhost:3000/login

5. **Razorpay webhook (needed for real end-to-end payment confirmation):**
   Razorpay must be able to reach your webhook URL, so localhost alone won't work.
   Use a tunnel (e.g. `ngrok http 3000`) during development, then in the
   Razorpay dashboard → Webhooks, add:
   - URL: `https://<your-tunnel>/api/webhooks/razorpay`
   - Secret: same value as `RAZORPAY_WEBHOOK_SECRET`
   - Event: `payment.captured`

   Note: the app also confirms payment via the checkout-modal's own signed
   response (`/api/checkout/verify`), so buyers get their download
   instantly without waiting on the webhook — the webhook exists as the
   authoritative reconciliation path (covers closed tabs, dropped
   connections, retried deliveries).

## Where things live

```
lib/services/storage/    StorageService interface + LocalFs / R2 implementations
lib/services/payment/    PaymentService interface + RazorpayPaymentService
lib/services/orders/     OrderService — PENDING → PAID lifecycle, download tokens, dashboard stats
lib/services/download/   DownloadService — token → watermarked PDF bytes
lib/services/watermark/  PdfWatermarkService + per-script font runs
lib/services/products/   ProductService — CRUD, tenant-scoped
lib/services/auth/       AuthService — login (rate-limited), session, credential changes
lib/services/email/      EmailService interface + Resend / Brevo / Console
lib/services/quizzes/    QuizService — quizzes, entries, scoring
lib/services/countdowns/ CountdownService — homepage exam countdowns
lib/services/notices/    NoticeService — homepage notice board
middleware.ts            maintenance mode, subdomain → x-store-slug header, /dashboard auth guard
prisma/schema.prisma     all models (Store, Product, Order, DownloadToken, Quiz, ...)
tests/                   Vitest unit tests (database, email and payment are faked)
```

## Development checks

```bash
npm test               # Vitest unit tests, no database needed
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm run format:check   # prettier (npm run format to fix)
```

GitHub Actions (`.github/workflows/ci.yml`) runs all four plus a production
build on every push and pull request.

## Deploying

- The build does **not** run migrations. Before deploying a commit that adds
  a migration under `prisma/migrations/`, apply it to the production
  database: `DATABASE_URL=<prod url> npx prisma migrate deploy`.
- Set every variable in `.env.example` that applies (R2, email provider,
  Razorpay live keys, `SESSION_SECRET`, `CRON_SECRET`).
- `vercel.json` schedules `/api/cron/cleanup-watermarks` daily. It only
  removes watermarked copies left over from before downloads stopped being
  cached, so it has nothing to do once those are gone.

## Known MVP scope cuts (intentional, not oversights)

- Only one store is seeded (`founder`); subdomain resolution middleware
  exists and is tested logically, but no second tenant exists to route to yet.
- Cover images are served unauthenticated (they're marketing material,
  not the paid asset) — product **files** are never reachable except
  through a redeemed download token.
- No refunds/coupons/multi-currency — out of MVP scope per the brief.
