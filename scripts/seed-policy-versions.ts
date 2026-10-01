/**
 * One-off, manual script — NOT a route, NOT deployed, NOT run on any
 * schedule. Run it locally, once, after applying migration
 * 20261001120000_add_policy_versions_and_consents, to backfill every
 * EXISTING store with a real PUBLISHED v1 of Terms/Privacy/Refund Policy.
 *
 * Loops over every Store row in the database — never hardcodes "founder"
 * — so this is genuinely ready for a second store to exist later with
 * zero changes to this script. Idempotent: a store that already has a
 * PUBLISHED v1 for a given policyType is skipped for that type, so
 * re-running this after a second store is added only backfills the new
 * one.
 *
 * The content inserted here is the exact text that used to be hardcoded
 * directly in app/c/[slug]/terms/page.tsx, privacy/page.tsx, and
 * refund-policy/page.tsx before those pages were rewritten to read from
 * the database (see PolicyService) — reproduced here as Markdown source
 * for lib/utils/markdown.ts to render, with each store's own slug
 * interpolated into the cross-links between policies, exactly as the
 * hardcoded JSX used store.slug before.
 *
 * ── Usage ──────────────────────────────────────────────────────────
 *   npx tsx prisma/../scripts/seed-policy-versions.ts
 * (run from the repo root; uses the same DATABASE_URL as everything else —
 * point it at your LOCAL DEV database, never production, same rule as
 * every other script/seed in this repo — see LOCAL_DEV.md)
 */
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EFFECTIVE_AT = new Date("2026-09-29T00:00:00.000Z");

function termsContent(slug: string): string {
  return `These Terms of Service ("Terms") govern your use of FrostEarth ("FrostEarth", "we", "us") and any purchase you make through this website. By placing an order or using this site, you agree to these Terms.

## 1. What we sell

FrostEarth sells digital PDF study notes and related digital products ("Products"). Products are delivered electronically — there is no physical shipment.

## 2. Orders and payment

Prices are listed in Indian Rupees (INR) and include all taxes unless stated otherwise. Payments are processed by Razorpay; we never see or store your card, UPI, or bank details ourselves. An order is confirmed only after Razorpay reports a successful, verified payment. Some Products may be offered free of charge — no payment step applies to those.

## 3. Delivery

Download links are sent **only by email**, to the address you provide at checkout. Please double-check your email address before paying — we are not able to redeliver a purchase to a different address than the one originally submitted, except at our discretion (see our [Refund Policy](/c/${slug}/refund-policy) for what we can do if an email genuinely never arrives). Download links expire after a limited time and after a limited number of uses; contact us if a link has expired and you still need your file.

## 4. License to use what you buy

Buying a Product gives you a personal, non-transferable license to download and use it for your own study purposes. You may not resell, redistribute, publicly share, or re-upload a Product, in whole or in part, in any form. Every copy we deliver is individually watermarked and carries embedded ownership metadata identifying the buyer — this exists specifically to trace unauthorized redistribution back to its source, and we reserve the right to take action (including legal action) against buyers who redistribute Products in breach of this license.

## 5. Quizzes and contests

Any quiz or contest run on this site is free to enter and skill-based — results are determined solely by correct answers and completion time, never by chance or random draw. No purchase is necessary or accepted as an entry requirement.

## 6. Our right to change or discontinue

We may update, correct, or discontinue a Product listing, or place the site into temporary maintenance, at any time. This does not affect any order already confirmed as paid before the change.

## 7. Limitation of liability

Products are provided "as is" for informational and educational use. To the maximum extent permitted by law, FrostEarth is not liable for any indirect, incidental, or consequential loss arising from your use of a Product, including exam outcomes.

## 8. Changes to these Terms

We may update these Terms from time to time. The "last updated" date above reflects the most recent revision. Continuing to use the site after a change means you accept the updated Terms.

## 9. Governing law

These Terms are governed by the laws of India. Any dispute arising from these Terms or your use of the site is subject to the exclusive jurisdiction of the courts at Puducherry, India.

## 10. Contact

Questions about these Terms? Write to [hello@frostearth.in](mailto:hello@frostearth.in).`;
}

function privacyContent(slug: string): string {
  return `This Privacy Policy explains what personal data FrostEarth ("FrostEarth", "we", "us") collects when you use this site, and how it is used. We aim to collect only what is genuinely needed to deliver your purchase and run the site.

## 1. What we collect

At checkout, we collect the name, email address, and mobile number you provide. We do not collect or store your card, UPI, or bank account details — those are handled entirely by Razorpay, our payment processor. When you enter a quiz, we similarly collect the name, email, and phone number you submit with that entry.

## 2. Why we collect it

- To create and fulfil your order, and to send your download link by email.
- To identify a purchased file as yours: every PDF we deliver is watermarked with the buyer's name, email, phone (if provided), and order number, both visibly and in the file's metadata — this protects against unauthorized redistribution and is a condition of the license described in our [Terms of Service](/c/${slug}/terms).
- To respond if you contact us for support, or if we need to resend a delivery.
- To operate a quiz you choose to enter, including scoring and ranking entries.

## 3. Who we share it with

We share the minimum data necessary with the following processors, solely to run the service:

- **Razorpay** — to process your payment.
- **Our email provider** (Resend or Brevo) — to send order and download emails.
- **Our file storage provider** (Cloudflare R2, or local storage in development) — to store product files and generate your watermarked download.

We do not sell your personal data to anyone, for any reason.

## 4. Cookies

We use a single, strictly necessary session cookie to keep a creator logged in to the dashboard. We do not use advertising or third-party tracking cookies on the public storefront.

## 5. How long we keep it

Order and transaction records are retained for 6 years from the end of the relevant financial year, in line with Indian tax record-keeping requirements. Data may be kept longer where needed for the license-enforcement purposes described above (e.g. identifying unauthorized redistribution of a purchased file).

## 6. Your rights

You can ask us what personal data we hold about you, ask us to correct it, or ask us to delete it (subject to what we're legally required to keep, such as transaction records), by writing to [hello@frostearth.in](mailto:hello@frostearth.in).

## 7. Children's privacy

This site is intended for students preparing for exams and is not directed at young children. If you believe a child has provided us personal data without appropriate consent, contact us and we will remove it.

## 8. Changes to this policy

We may update this Privacy Policy from time to time. The "last updated" date above reflects the most recent revision.

## 9. Contact

Questions about this policy, or a request about your data? Write to [hello@frostearth.in](mailto:hello@frostearth.in).`;
}

function refundContent(slug: string): string {
  return `Because our Products are digital files delivered instantly by email, our refund policy works differently from a physical-goods store.

## 1. No refunds once a file has been delivered

Once your download link has been emailed to you, the order is treated as fulfilled and is **not eligible for a refund** — this applies whether or not you actually open the link, for the same reason a store can't take back a book once it's been handed over. Please review a Product's description carefully before paying.

## 2. When we will make an exception

We will refund or re-deliver, at our discretion, in cases such as:

- Payment was captured by Razorpay but no order was created on our end (a technical failure on our side).
- The email with your download link never arrived, and we are unable to resend it to any working address within a reasonable time.
- The delivered PDF is genuinely corrupted or unopenable, and re-sending a fresh copy does not resolve it.
- You were charged more than once for the same order (a duplicate payment).

We are not able to refund a purchase simply because a buyer changes their mind, or mistyped their own email address at checkout — see our [Terms of Service](/c/${slug}/terms) for the checkout email warning shown before payment.

## 3. How to request an exception

Email [hello@frostearth.in](mailto:hello@frostearth.in) with your order number, the email address used at checkout, and a description of the issue. We aim to respond within a few business days.

## 4. How a refund is issued

Approved refunds are issued back to the original payment method via Razorpay, and may take several business days to reflect depending on your bank or payment provider.

## 5. Quizzes

Our quizzes are free to enter — no payment is ever collected for a quiz entry, so this policy does not apply to them.`;
}

const POLICIES: { policyType: "TERMS" | "PRIVACY" | "REFUND_POLICY"; title: string; content: (slug: string) => string }[] = [
  { policyType: "TERMS", title: "Terms of Service", content: termsContent },
  { policyType: "PRIVACY", title: "Privacy Policy", content: privacyContent },
  { policyType: "REFUND_POLICY", title: "Refund Policy", content: refundContent },
];

async function main() {
  const stores = await prisma.store.findMany();
  console.log(`Found ${stores.length} store(s).`);

  for (const store of stores) {
    for (const policy of POLICIES) {
      const existing = await prisma.policyVersion.findFirst({
        where: { storeId: store.id, policyType: policy.policyType, status: "PUBLISHED" },
      });
      if (existing) {
        console.log(`  [skip] ${store.slug} / ${policy.policyType} — already has a PUBLISHED version (v${existing.version})`);
        continue;
      }

      const content = policy.content(store.slug);
      const contentHash = crypto.createHash("sha256").update(content, "utf8").digest("hex");

      const created = await prisma.policyVersion.create({
        data: {
          storeId: store.id,
          policyType: policy.policyType,
          version: 1,
          title: policy.title,
          content,
          status: "PUBLISHED",
          effectiveAt: EFFECTIVE_AT,
          contentHash,
        },
      });

      console.log(`  [seeded] ${store.slug} / ${policy.policyType} — v${created.version}, hash ${contentHash.slice(0, 12)}…`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
