"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface FailedOrder {
  reason: string;
}

/**
 * The name/email/phone form + Razorpay flow. Failure stays local state
 * (reported to the parent, see CartPage) — nothing time-sensitive is lost
 * if that view disappears on refresh. Success is different: it redirects
 * to a persistent order page instead, since a refresh previously wiped
 * the buyer's only on-screen copy of their download links.
 */
export default function CartCheckout({ onFailure }: { onFailure: (failure: FailedOrder) => void }) {
  const { items, totalInPaise, clear } = useCart();
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function loadRazorpayScript(): Promise<boolean> {
    if (window.Razorpay) return true;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handlePay() {
    setError(null);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setStatus("processing");

    const createRes = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productIds: items.map((i) => i.productId),
        buyerName: name,
        buyerEmail: email,
        buyerPhone: digitsOnly,
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      setStatus("idle");
      setError(typeof created.error === "string" ? created.error : "Could not start checkout");
      return;
    }

    // A ₹0 cart is finalized as PAID directly by the server — no
    // Razorpay order ever existed for it, so there's nothing to open a
    // payment modal for. Skip straight to the confirmation page, exactly
    // like the normal post-payment success path below does.
    if (created.status === "PAID") {
      setStatus("idle");
      clear();
      router.push(`/c/${slug}/order/${created.orderId}`);
      return;
    }

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setStatus("idle");
      setError("Could not load payment gateway. Check your connection.");
      return;
    }

    const rzp = new window.Razorpay({
      key: created.keyId,
      amount: created.amountInPaise,
      currency: "INR",
      name: "FrostEarth",
      order_id: created.razorpayOrderId,
      prefill: { name, email, contact: digitsOnly },
      method: { upi: true, card: true, netbanking: true },
      handler: async (response: any) => {
        const verifyRes = await fetch("/api/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: created.orderId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });
        const verified = await verifyRes.json();
        setStatus("idle");
        if (verifyRes.ok && verified.status === "PAID" && verified.downloads?.length) {
          clear();
          // created.orderId is already our internal Order.id from the
          // /api/checkout response above — no need to fetch anything else,
          // the order confirmation page loads its own data server-side.
          router.push(`/c/${slug}/order/${created.orderId}`);
        } else {
          onFailure({
            reason:
              "Payment could not be verified. If you were charged, contact support with your email and order details.",
          });
        }
      },
      // Fires when Razorpay itself reports the payment failed (declined,
      // insufficient funds, etc.) — distinct from the buyer just closing
      // the modal (handled by modal.ondismiss below).
      modal: {
        ondismiss: () => setStatus("idle"),
      },
    });

    rzp.on("payment.failed", (response: any) => {
      setStatus("idle");
      onFailure({ reason: response?.error?.description || "Payment failed." });
    });

    rzp.open();
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-full border border-fog px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-frost"
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-full border border-fog px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-frost"
      />
      <input
        type="tel"
        inputMode="numeric"
        maxLength={10}
        placeholder="10-digit mobile number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-full border border-fog px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-frost"
      />
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-900">
          <span aria-hidden="true">⚠</span> Notes are delivered <span className="font-semibold">ONLY via email</span> —
          please double-check your email address before paying. We cannot resend to a different address if this one is
          wrong.
        </p>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handlePay}
        disabled={status === "processing" || items.length === 0}
        className="w-full rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-3 py-2.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        {status === "processing" ? "Processing…" : `Pay ₹${(totalInPaise / 100).toLocaleString("en-IN")}`}
      </button>
    </div>
  );
}
