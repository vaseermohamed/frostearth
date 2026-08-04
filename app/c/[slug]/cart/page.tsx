"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import CartCheckout, { CompletedOrder, FailedOrder } from "@/components/CartCheckout";

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
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-lg border border-green-200 p-6">
          <p className="text-lg font-semibold text-green-700 mb-1">Payment successful</p>
          <p className="text-sm text-frost-500 mb-4">Order #{completed.orderNumber}</p>
          <div className="space-y-2 mb-4">
            {completed.downloads.map((d) => (
              <a
                key={d.token}
                href={`/api/download/${d.token}`}
                className="block text-sm bg-green-600 hover:bg-green-700 text-white rounded-md px-3 py-2 text-center"
              >
                Download: {d.title}
              </a>
            ))}
          </div>
          <p className="text-xs text-frost-500 mb-4">
            These links have also been emailed to you and stay valid for 3 days.
          </p>
          <Link href="/" className="text-sm text-frost-900 underline">
            ← Back to store
          </Link>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-lg border border-red-200 p-6">
          <p className="text-lg font-semibold text-red-700 mb-1">Payment failed</p>
          <p className="text-sm text-frost-500 mb-4">{failed.reason}</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFailed(null)}
              className="text-sm bg-frost-500 hover:bg-frost-600 text-white rounded-md px-4 py-2"
            >
              Try again
            </button>
            <Link href="/" className="text-sm text-frost-900 underline">
              Back to store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="font-display text-2xl text-frost-900 mb-6">Your cart</h1>

      {items.length === 0 ? (
        <p className="text-frost-500">
          Your cart is empty. <Link href="/" className="text-frost-900 underline">Browse products</Link>
        </p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-[1fr_280px]">
          <div className="bg-white rounded-lg border border-frost-100 divide-y divide-frost-100">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-3 px-4 py-4">
                {item.coverImageKey && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/storage/${item.coverImageKey}`}
                    alt=""
                    className="w-14 h-14 object-cover rounded-md shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-frost-900 truncate">{item.title}</p>
                  <p className="text-sm text-frost-500">
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

          <div className="bg-white rounded-lg border border-frost-100 p-5 h-fit">
            <div className="flex items-center justify-between text-sm font-medium mb-4">
              <span>Total</span>
              <span>₹{(totalInPaise / 100).toLocaleString("en-IN")}</span>
            </div>
            <CartCheckout onSuccess={setCompleted} onFailure={setFailed} />
          </div>
        </div>
      )}
    </div>
  );
}
