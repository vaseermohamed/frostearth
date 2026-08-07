"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import CartCheckout, { FailedOrder } from "@/components/CartCheckout";
import NotebookPlaceholder from "@/components/NotebookPlaceholder";

/**
 * On a successful payment, CartCheckout redirects straight to the
 * persistent /c/{slug}/order/{orderId} confirmation page instead of
 * flipping local state here — a refresh on that page still shows the
 * buyer's downloads, where a refresh of in-memory state here would have
 * lost them. Failure stays local state: there's nothing time-sensitive
 * or hard-to-recover about it, so a refresh just showing a normal
 * (possibly empty) cart again is fine.
 */
export default function CartPage() {
  const { items, removeItem, totalInPaise } = useCart();
  const [failed, setFailed] = useState<FailedOrder | null>(null);

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
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* "Your details" — left on desktop, second on mobile (buyer sees what they're buying first) */}
          <div className="bg-white rounded-2xl border border-fog p-6 order-2 lg:order-1">
            <h2 className="font-display font-extrabold text-lg text-ink mb-4">Your details</h2>
            <CartCheckout onFailure={setFailed} />
          </div>

          {/* "Order summary" — right sidebar on desktop, first/top on mobile */}
          <div className="bg-white rounded-2xl border border-fog p-6 h-fit order-1 lg:order-2">
            <h2 className="font-display font-extrabold text-lg text-ink mb-4">Order summary</h2>
            <div className="divide-y divide-fog border-t border-fog">
              {items.map((item) => (
                <div key={item.productId} className="flex items-start gap-3 py-4 min-w-0">
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
                    <p className="text-sm font-medium text-ink leading-snug break-words">{item.title}</p>
                    <p className="text-sm font-mono text-slate mt-1">
                      ₹{(item.priceInPaise / 100).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-xs text-red-600 hover:text-red-800 shrink-0 mt-0.5"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-fog pt-4 mt-4">
              <span className="font-medium text-ink">Total</span>
              <span className="font-mono font-bold text-ink text-lg">
                ₹{(totalInPaise / 100).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
