"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";

declare global {
  interface Window {
    Razorpay: any;
  }
}

/**
 * The email/phone form + Razorpay flow, embedded inside the cart
 * dropdown. Structurally the same confirmation pattern as the old
 * single-item CheckoutButton, just driven by every item in the cart
 * instead of one productId.
 */
export default function CartCheckout({ onDone }: { onDone?: () => void }) {
  const { items, totalInPaise, clear } = useCart();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "paid" | "error">("idle");
  const [downloads, setDownloads] = useState<{ title: string; token: string }[]>([]);
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

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }
    const digitsOnly = phone.replace(/\D/g, "");
    if (phone && digitsOnly.length !== 10) {
      setError("Mobile number must be exactly 10 digits.");
      return;
    }

    setStatus("processing");

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setStatus("error");
      setError("Could not load payment gateway. Check your connection.");
      return;
    }

    const createRes = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productIds: items.map((i) => i.productId),
        buyerEmail: email,
        buyerPhone: digitsOnly || undefined,
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      setStatus("error");
      setError(typeof created.error === "string" ? created.error : "Could not start checkout");
      return;
    }

    const rzp = new window.Razorpay({
      key: created.keyId,
      amount: created.amountInPaise,
      currency: "INR",
      name: "FrostEarth",
      order_id: created.razorpayOrderId,
      prefill: { email, contact: digitsOnly || undefined },
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
        if (verifyRes.ok && verified.status === "PAID" && verified.downloads?.length) {
          setDownloads(verified.downloads);
          setStatus("paid");
          clear();
        } else {
          setStatus("error");
          setError("Payment could not be verified. If you were charged, contact support with your email.");
        }
      },
      modal: {
        ondismiss: () => setStatus("idle"),
      },
    });

    rzp.open();
  }

  if (status === "paid") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-green-700">Payment successful — download your files:</p>
        {downloads.map((d) => (
          <a
            key={d.token}
            href={`/api/download/${d.token}`}
            className="block text-sm bg-green-600 hover:bg-green-700 text-white rounded-md px-3 py-2 text-center"
          >
            {d.title}
          </a>
        ))}
        {onDone && (
          <button onClick={onDone} className="text-xs text-frost-500 hover:text-frost-900 mt-2">
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-frost-100 px-2 py-1.5 text-sm"
      />
      <input
        type="tel"
        inputMode="numeric"
        maxLength={10}
        placeholder="10-digit mobile number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-md border border-frost-100 px-2 py-1.5 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handlePay}
        disabled={status === "processing" || items.length === 0}
        className="w-full bg-clay-500 hover:opacity-90 text-white text-sm font-medium rounded-md px-3 py-2 disabled:opacity-60"
      >
        {status === "processing" ? "Processing…" : `Pay ₹${(totalInPaise / 100).toLocaleString("en-IN")}`}
      </button>
    </div>
  );
}
