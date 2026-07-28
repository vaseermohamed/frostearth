"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import CartCheckout from "@/components/CartCheckout";

export default function CartPage() {
  const { items, removeItem, totalInPaise } = useCart();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="font-display text-2xl text-frost-900 mb-6">Your cart</h1>

      {items.length === 0 ? (
        <p className="text-frost-500">
          Your cart is empty. <Link href="../" className="text-frost-900 underline">Browse products</Link>
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
            <CartCheckout />
          </div>
        </div>
      )}
    </div>
  );
}
