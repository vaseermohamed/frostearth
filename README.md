# FrostEarth — MVP

A single-creator (architecturally multi-tenant-ready) digital-product storefront:
PDF upload, public product pages, Razorpay UPI checkout, and secure post-payment download.

## What's actually wired up (no mocks)

- Real Postgres schema via Prisma, every business table carries `storeId`
- Real bcrypt-hashed password auth with signed JWT session cookies
- Real file storage on local disk (behind a `StorageService` interface —
  swap in S3/R2/MinIO later with zero call-site changes)
- Real Razorpay order creation, checkout, and **webhook signature
  verification** (never trusts the client-side redirect alone)
- Real download tokens: time-limited, use-limited, only issued after a
  verified payment

## Setup

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
lib/services/storage/   StorageService interface + LocalFsStorageService
lib/services/payment/   PaymentService interface + RazorpayPaymentService
lib/services/orders/    OrderService — PENDING → PAID lifecycle, download tokens
lib/services/products/  ProductService — CRUD, tenant-scoped
lib/services/auth/      AuthService — login/session
lib/services/email/     EmailService interface (stubbed to console; not on MVP critical path)
middleware.ts            subdomain → x-store-slug header, /dashboard auth guard
prisma/schema.prisma      Store / User / Product / Order / DownloadToken
```

## Known MVP scope cuts (intentional, not oversights)

- Only one store is seeded (`founder`); subdomain resolution middleware
  exists and is tested logically, but no second tenant exists to route to yet.
- Cover images are served unauthenticated (they're marketing material,
  not the paid asset) — product **files** are never reachable except
  through a redeemed download token.
- No email delivery — `EmailService` is stubbed to `console.log` so a
  real provider (Resend/Postmark/SES) is a single-file change, not a
  refactor.
- No refunds/coupons/multi-currency — out of MVP scope per the brief.
