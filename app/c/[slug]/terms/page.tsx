import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import LegalDocument from "@/components/LegalDocument";

export default async function TermsPage({ params }: { params: { slug: string } }) {
  const { store } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  return (
    <LegalDocument title="Terms of Service" updated="29 September 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of FrostEarth
        (&quot;FrostEarth&quot;, &quot;we&quot;, &quot;us&quot;) and any purchase you make through
        this website. By placing an order or using this site, you agree to
        these Terms.
      </p>

      <h2>1. What we sell</h2>
      <p>
        FrostEarth sells digital PDF study notes and related digital products
        (&quot;Products&quot;). Products are delivered electronically — there is no
        physical shipment.
      </p>

      <h2>2. Orders and payment</h2>
      <p>
        Prices are listed in Indian Rupees (INR) and include all taxes unless
        stated otherwise. Payments are processed by Razorpay; we never see or
        store your card, UPI, or bank details ourselves. An order is
        confirmed only after Razorpay reports a successful, verified
        payment. Some Products may be offered free of charge — no payment
        step applies to those.
      </p>

      <h2>3. Delivery</h2>
      <p>
        Download links are sent <strong>only by email</strong>, to the address
        you provide at checkout. Please double-check your email address
        before paying — we are not able to redeliver a purchase to a
        different address than the one originally submitted, except at our
        discretion (see our{" "}
        <a href={`/c/${store.slug}/refund-policy`}>Refund Policy</a> for what
        we can do if an email genuinely never arrives). Download links expire
        after a limited time and after a limited number of uses; contact us
        if a link has expired and you still need your file.
      </p>

      <h2>4. License to use what you buy</h2>
      <p>
        Buying a Product gives you a personal, non-transferable license to
        download and use it for your own study purposes. You may not
        resell, redistribute, publicly share, or re-upload a Product, in
        whole or in part, in any form. Every copy we deliver is individually
        watermarked and carries embedded ownership metadata identifying the
        buyer — this exists specifically to trace unauthorized redistribution
        back to its source, and we reserve the right to take action
        (including legal action) against buyers who redistribute Products in
        breach of this license.
      </p>

      <h2>5. Quizzes and contests</h2>
      <p>
        Any quiz or contest run on this site is free to enter and
        skill-based — results are determined solely by correct answers and
        completion time, never by chance or random draw. No purchase is
        necessary or accepted as an entry requirement.
      </p>

      <h2>6. Our right to change or discontinue</h2>
      <p>
        We may update, correct, or discontinue a Product listing, or place
        the site into temporary maintenance, at any time. This does not
        affect any order already confirmed as paid before the change.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        Products are provided &quot;as is&quot; for informational and educational
        use. To the maximum extent permitted by law, FrostEarth is not liable
        for any indirect, incidental, or consequential loss arising from
        your use of a Product, including exam outcomes.
      </p>

      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The &quot;last updated&quot;
        date above reflects the most recent revision. Continuing to use the
        site after a change means you accept the updated Terms.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Any dispute arising
        from these Terms or your use of the site is subject to the
        exclusive jurisdiction of the courts at Puducherry, India.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms? Write to{" "}
        <a href="mailto:hello@frostearth.in">hello@frostearth.in</a>.
      </p>
    </LegalDocument>
  );
}
