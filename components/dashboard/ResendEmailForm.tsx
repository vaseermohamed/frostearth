"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Same pattern CartCheckout uses for the checkout form — kept identical
// so "valid email" means the same thing everywhere in the app.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResendEmailForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleResend() {
    setError(null);
    setSuccess(null);

    if (!EMAIL_PATTERN.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("sending");
    const res = await fetch(`/api/admin/orders/${orderId}/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setStatus("idle");

    if (res.ok) {
      setSuccess(`Resent to ${data.sentTo}.`);
      setEmail("");
      router.refresh(); // reloads this page's server-fetched delivery history
    } else {
      setError(typeof data.error === "string" ? data.error : "Could not resend. Try again.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          placeholder="Send to a different email…"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-0 rounded-full border border-fog px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-frost"
        />
        <button
          onClick={handleResend}
          disabled={status === "sending"}
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-4 py-2 disabled:opacity-60 shrink-0"
        >
          {status === "sending" ? "Sending…" : "Resend"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-frost">{success}</p>}
    </div>
  );
}
