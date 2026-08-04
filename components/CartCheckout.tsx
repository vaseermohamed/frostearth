"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface CompletedOrder {
  orderNumber: number;
  downloads: { title: string; token: string }[];
}

export interface FailedOrder {
  reason: string;
}

/**
 * The name/email/phone form + Razorpay flow. Success and failure are
 * reported to the PARENT via callbacks rather than held in local state
 * here — this component's own state gets thrown away the moment the
 * cart clears (which happens right after a successful payment), so
 * anything that needs to survive that (the receipt, the failure
 * message) has to live one level up. See CartPage.
 */
export default function CartCheckout({
  onSuccess,
  onFailure,
}: {
  onSuccess: (order: CompletedOrder) => void;
  onFailure: (failure: FailedOrder) => void;
}) {
  const { items, totalInPaise, clear } = useCart();
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
    if (phone && digitsOnly.length !== 10) {
      setError("Mobile number must be exactly 10 digits.");
      return;
    }

    setStatus("processing");

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setStatus("idle");
      setError("Could not load payment gateway. Check your connection.");
      return;
    }

    const createRes = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productIds: items.map((i) => i.productId),
        buyerName: name,
        buyerEmail: email,
        buyerPhone: digitsOnly || undefined,
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      setStatus("idle");
      setError(typeof created.error === "string" ? created.error : "Could not start checkout");
      return;
    }

    const rzp = new window.Razorpay({
      key: created.keyId,
      amount: created.amountInPaise,
      currency: "INR",
      name: "FrostEarth",
      order_id: created.razorpayOrderId,
      prefill: { name, email, contact: digitsOnly || undefined },
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
          onSuccess({ orderNumber: verified.orderNumber, downloads: verified.downloads });
        } else {
          onFailure({
            reason: "Payment could not be verified. If you were charged, contact support with your email and order details.",
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
        className="w-full rounded-md border border-frost-100 px-2 py-1.5 text-sm"
      />
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
