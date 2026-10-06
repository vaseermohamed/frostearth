import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { formatOrderNumber } from "@/lib/services/orders/orderFilters";

/**
 * A real, persistent, refresh-safe replacement for what used to be
 * in-memory "completed" state on the cart page — a page refresh there
 * lost the buyer's only on-screen copy of their download links, even
 * though the order and its tokens still legitimately existed. The
 * orderId itself is the access control (same trust model download
 * tokens already use) — no buyer login exists in this guest-checkout
 * model, so none is required here either.
 */
export default async function OrderConfirmationPage({ params }: { params: { slug: string; orderId: string } }) {
  const { store } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  const order = await getOrderService().getForStore(store.id, params.orderId);
  if (!order) notFound();

  if (order.status === "PENDING") {
    return (
      <StatusPage
        badgeClassName="bg-fog text-slate"
        icon={<ClockIcon />}
        title="Almost there…"
        message="We're still confirming your payment — this usually only takes a few seconds. Refresh this page in a moment."
        backHref="/"
        backLabel="← Back to store"
      />
    );
  }

  if (order.status === "FAILED") {
    return (
      <StatusPage
        badgeClassName="bg-red-50 text-red-600"
        icon={<XIcon />}
        title="Payment failed"
        message="Your payment didn't go through, so nothing was charged for this order. You can try again from your cart."
        backHref={`/c/${store.slug}/cart`}
        backLabel="Try again"
        backAsButton
      />
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12 sm:py-16">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-full bg-frost flex items-center justify-center">
          <CheckIcon />
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="font-display font-black text-2xl text-ink mb-2">Payment successful</h1>
        <p className="font-mono text-sm text-slate">Order #{formatOrderNumber(order.orderNumber)}</p>
      </div>

      <div className="bg-white rounded-2xl border border-fog p-5 mb-6">
        <div className="space-y-3 mb-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-fog flex items-center justify-center shrink-0 text-slate">
                <FileIcon />
              </div>
              <p className="text-sm font-medium text-ink break-words">{item.titleSnapshot}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-fog">
          <span className="text-sm text-slate">Amount paid</span>
          <span className="font-mono text-sm text-ink">₹{(order.amountInPaise / 100).toLocaleString("en-IN")}</span>
        </div>
      </div>

      <div className="bg-frost/5 rounded-2xl border border-frost/20 p-5 mb-8 text-center">
        <p className="text-sm text-ink mb-1">
          Your files are being emailed to <span className="font-medium">{order.buyerEmail}</span>.
        </p>
        <p className="text-sm text-slate">
          Delivery is usually instant — check your inbox (and spam folder) in a few minutes.
        </p>
        <p className="text-sm text-slate mt-3">
          Didn&apos;t receive it? Contact us at{" "}
          <a href="mailto:hello@frostearth.in" className="text-ink underline">
            hello@frostearth.in
          </a>{" "}
          with your order number.
        </p>
      </div>

      <div className="text-center">
        <Link href="/" className="text-sm text-ink underline">
          ← Back to store
        </Link>
      </div>
    </div>
  );
}

function StatusPage({
  badgeClassName,
  icon,
  title,
  message,
  backHref,
  backLabel,
  backAsButton,
}: {
  badgeClassName: string;
  icon: React.ReactNode;
  title: string;
  message: string;
  backHref: string;
  backLabel: string;
  backAsButton?: boolean;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-12 sm:py-16 text-center">
      <div className="flex justify-center mb-6">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${badgeClassName}`}>{icon}</div>
      </div>
      <h1 className="font-display font-black text-2xl text-ink mb-2">{title}</h1>
      <p className="text-sm text-slate mb-8 max-w-sm mx-auto">{message}</p>
      {backAsButton ? (
        <Link
          href={backHref}
          className="inline-block rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-5 py-2.5"
        >
          {backLabel}
        </Link>
      ) : (
        <Link href={backHref} className="text-sm text-ink underline">
          {backLabel}
        </Link>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
