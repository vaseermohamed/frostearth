"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";

/**
 * Cart icon in the header. Clicking always navigates to the full cart
 * page. Hovering shows a lightweight preview dropdown — the dropdown
 * sits with NO gap directly under the trigger (padding-top instead of
 * margin-top) so the mouse path from icon to dropdown never crosses an
 * un-hoverable gap that would close it early.
 */
export default function CartWidget({ storeSlug }: { storeSlug: string }) {
  const { items, removeItem, totalInPaise } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        href={`/c/${storeSlug}/cart`}
        className="flex items-center gap-2 rounded-full bg-ink text-paper pl-3.5 pr-4 py-2 text-sm font-medium hover:bg-ink/85 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-frost focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <span className="font-mono">{items.length}</span>
      </Link>

      {open && (
        // pt-2 (not the wrapper's margin) keeps this flush against the
        // trigger above — no dead zone for the mouse to fall through.
        <div className="absolute right-0 top-full pt-3 w-72 z-50">
          <div className="bg-paper rounded-2xl border border-fog shadow-xl shadow-ink/5 p-4">
            {items.length === 0 ? (
              <p className="text-sm text-slate">Your cart is empty.</p>
            ) : (
              <>
                <div className="space-y-3 mb-3 max-h-56 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-ink truncate">{item.title}</p>
                        <p className="text-xs font-mono text-slate">
                          ₹{(item.priceInPaise / 100).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-xs text-red-600 hover:text-red-800 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm font-medium border-t border-fog pt-3 mb-3">
                  <span className="text-ink">Total</span>
                  <span className="font-mono text-ink">₹{(totalInPaise / 100).toLocaleString("en-IN")}</span>
                </div>
                <Link
                  href={`/c/${storeSlug}/cart`}
                  className="block text-center w-full rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-3 py-2.5"
                >
                  View cart & checkout
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
