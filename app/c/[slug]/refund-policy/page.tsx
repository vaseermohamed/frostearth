import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import LegalDocument from "@/components/LegalDocument";

export default async function RefundPolicyPage({ params }: { params: { slug: string } }) {
  const { store } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  return (
    <LegalDocument title="Refund Policy" updated="29 September 2026">
      <p>
        Because our Products are digital files delivered instantly by email, our refund
        policy works differently from a physical-goods store.
      </p>

      <h2>1. No refunds once a file has been delivered</h2>
      <p>
        Once your download link has been emailed to you, the order is treated as fulfilled
        and is <strong>not eligible for a refund</strong> — this applies whether or not you
        actually open the link, for the same reason a store can&apos;t take back a book once
        it&apos;s been handed over. Please review a Product&apos;s description carefully before
        paying.
      </p>

      <h2>2. When we will make an exception</h2>
      <p>We will refund or re-deliver, at our discretion, in cases such as:</p>
      <ul>
        <li>Payment was captured by Razorpay but no order was created on our end (a technical failure on our side).</li>
        <li>The email with your download link never arrived, and we are unable to resend it to any working address within a reasonable time.</li>
        <li>The delivered PDF is genuinely corrupted or unopenable, and re-sending a fresh copy does not resolve it.</li>
        <li>You were charged more than once for the same order (a duplicate payment).</li>
      </ul>
      <p>
        We are not able to refund a purchase simply because a buyer changes their mind, or
        mistyped their own email address at checkout — see our{" "}
        <a href={`/c/${store.slug}/terms`}>Terms of Service</a> for the checkout email
        warning shown before payment.
      </p>

      <h2>3. How to request an exception</h2>
      <p>
        Email <a href="mailto:hello@frostearth.in">hello@frostearth.in</a> with your order
        number, the email address used at checkout, and a description of the issue. We aim
        to respond within a few business days.
      </p>

      <h2>4. How a refund is issued</h2>
      <p>
        Approved refunds are issued back to the original payment method via Razorpay, and
        may take several business days to reflect depending on your bank or payment
        provider.
      </p>

      <h2>5. Quizzes</h2>
      <p>
        Our quizzes are free to enter — no payment is ever collected for a quiz entry, so
        this policy does not apply to them.
      </p>
    </LegalDocument>
  );
}
