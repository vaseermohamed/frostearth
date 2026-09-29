import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import LegalDocument from "@/components/LegalDocument";

export default async function PrivacyPage({ params }: { params: { slug: string } }) {
  const { store } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  return (
    <LegalDocument title="Privacy Policy" updated="29 September 2026">
      <p>
        This Privacy Policy explains what personal data FrostEarth
        (&quot;FrostEarth&quot;, &quot;we&quot;, &quot;us&quot;) collects when you use this site, and
        how it is used. We aim to collect only what is genuinely needed to
        deliver your purchase and run the site.
      </p>

      <h2>1. What we collect</h2>
      <p>At checkout, we collect the name, email address, and mobile number you provide.
        We do not collect or store your card, UPI, or bank account details — those are
        handled entirely by Razorpay, our payment processor. When you enter a quiz, we
        similarly collect the name, email, and phone number you submit with that entry.
      </p>

      <h2>2. Why we collect it</h2>
      <ul>
        <li>To create and fulfil your order, and to send your download link by email.</li>
        <li>
          To identify a purchased file as yours: every PDF we deliver is watermarked with
          the buyer&apos;s name, email, phone (if provided), and order number, both visibly
          and in the file&apos;s metadata — this protects against unauthorized redistribution
          and is a condition of the license described in our{" "}
          <a href={`/c/${store.slug}/terms`}>Terms of Service</a>.
        </li>
        <li>To respond if you contact us for support, or if we need to resend a delivery.</li>
        <li>To operate a quiz you choose to enter, including scoring and ranking entries.</li>
      </ul>

      <h2>3. Who we share it with</h2>
      <p>We share the minimum data necessary with the following processors, solely to run the service:</p>
      <ul>
        <li><strong>Razorpay</strong> — to process your payment.</li>
        <li><strong>Our email provider</strong> (Resend or Brevo) — to send order and download emails.</li>
        <li><strong>Our file storage provider</strong> (Cloudflare R2, or local storage in development) — to store product files and generate your watermarked download.</li>
      </ul>
      <p>We do not sell your personal data to anyone, for any reason.</p>

      <h2>4. Cookies</h2>
      <p>
        We use a single, strictly necessary session cookie to keep a creator logged in to
        the dashboard. We do not use advertising or third-party tracking cookies on the
        public storefront.
      </p>

      <h2>5. How long we keep it</h2>
      <p>
        Order and transaction records are retained for 6 years from the end of the
        relevant financial year, in line with Indian tax record-keeping requirements. Data
        may be kept longer where needed for the license-enforcement purposes described
        above (e.g. identifying unauthorized redistribution of a purchased file).
      </p>

      <h2>6. Your rights</h2>
      <p>
        You can ask us what personal data we hold about you, ask us to correct it, or ask
        us to delete it (subject to what we&apos;re legally required to keep, such as
        transaction records), by writing to{" "}
        <a href="mailto:hello@frostearth.in">hello@frostearth.in</a>.
      </p>

      <h2>7. Children&apos;s privacy</h2>
      <p>
        This site is intended for students preparing for exams and is not directed at
        young children. If you believe a child has provided us personal data without
        appropriate consent, contact us and we will remove it.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The &quot;last updated&quot; date
        above reflects the most recent revision.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about this policy, or a request about your data? Write to{" "}
        <a href="mailto:hello@frostearth.in">hello@frostearth.in</a>.
      </p>
    </LegalDocument>
  );
}
