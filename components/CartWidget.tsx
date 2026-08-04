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
      <Link href={`/c/${storeSlug}/cart`} className="flex items-center gap-1.5 text-frost-900 font-medium">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <span className="text-sm">{items.length}</span>
      </Link>

      {open && (
        // pt-2 (not the wrapper's margin) keeps this flush against the
        // trigger above — no dead zone for the mouse to fall through.
        <div className="absolute right-0 top-full pt-2 w-72 z-50">
          <div className="bg-white rounded-lg border border-frost-100 shadow-lg p-4">
            {items.length === 0 ? (
              <p className="text-sm text-frost-500">Your cart is empty.</p>
            ) : (
              <>
                <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-frost-900 truncate">{item.title}</p>
                        <p className="text-xs text-frost-500">
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
                <div className="flex items-center justify-between text-sm font-medium border-t border-frost-100 pt-2 mb-3">
                  <span>Total</span>
                  <span>₹{(totalInPaise / 100).toLocaleString("en-IN")}</span>
                </div>
                <Link
                  href={`/c/${storeSlug}/cart`}
                  className="block text-center w-full bg-frost-500 hover:bg-frost-600 text-white text-sm font-medium rounded-md px-3 py-2"
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
