"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import CartCheckout, { CompletedOrder, FailedOrder } from "@/components/CartCheckout";
import NotebookPlaceholder from "@/components/NotebookPlaceholder";

export default function CartPage() {
  const { items, removeItem, totalInPaise } = useCart();
  const [completed, setCompleted] = useState<CompletedOrder | null>(null);
  const [failed, setFailed] = useState<FailedOrder | null>(null);

  // Order completion state is separate from `items` on purpose: a
  // successful payment clears the cart, which would otherwise unmount
  // this whole view and silently swap in the "cart is empty" message —
  // hiding the receipt and download links right when the buyer needs
  // them most. Checking `completed`/`failed` FIRST avoids that.
  if (completed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white rounded-2xl border border-green-200 p-6">
          <p className="font-display font-extrabold text-lg text-green-700 mb-1">Payment successful</p>
          <p className="text-sm font-mono text-slate mb-4">Order #{completed.orderNumber}</p>
          <div className="space-y-2 mb-4">
            {completed.downloads.map((d) => (
              <a
                key={d.token}
                href={`/api/download/${d.token}`}
                className="block text-sm bg-green-600 hover:bg-green-700 text-white rounded-full px-3 py-2.5 text-center transition-colors"
              >
                Download: {d.title}
              </a>
            ))}
          </div>
          <p className="text-xs text-slate mb-4">
            These links have also been emailed to you and stay valid for 3 days.
          </p>
          <Link href="/" className="text-sm text-ink underline">
            ← Back to store
          </Link>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white rounded-2xl border border-red-200 p-6">
          <p className="font-display font-extrabold text-lg text-red-700 mb-1">Payment failed</p>
          <p className="text-sm text-slate mb-4">{failed.reason}</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFailed(null)}
              className="text-sm bg-frost hover:opacity-90 transition-opacity text-white rounded-full px-4 py-2"
            >
              Try again
            </button>
            <Link href="/" className="text-sm text-ink underline">
              Back to store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <h1 className="font-display font-black text-2xl sm:text-3xl text-ink mb-8">Your cart</h1>

      {items.length === 0 ? (
        <p className="text-slate">
          Your cart is empty. <Link href="/" className="text-ink underline">Browse products</Link>
        </p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-[1fr_300px]">
          <div className="bg-white rounded-sm border border-fog divide-y divide-fog">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-3 px-4 py-4">
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-fog">
                  {item.coverImageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/storage/${item.coverImageKey}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <NotebookPlaceholder className="w-full h-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                  <p className="text-sm font-mono text-slate">
                    ₹{(item.priceInPaise / 100).toLocaleString("en-IN")}
                  </p>
                </div>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="text-sm text-red-600 hover:text-red-800 shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-fog p-5 h-fit">
            <div className="flex items-center justify-between text-sm font-medium mb-4">
              <span className="text-ink">Total</span>
              <span className="font-mono text-ink">₹{(totalInPaise / 100).toLocaleString("en-IN")}</span>
            </div>
            <CartCheckout onSuccess={setCompleted} onFailure={setFailed} />
          </div>
        </div>
      )}
    </div>
  );
}
