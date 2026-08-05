"use client";

import { useAddToCart } from "@/lib/cart/useAddToCart";

export default function AddToCartButton({
  productId,
  title,
  priceInPaise,
  coverImageKey,
}: {
  productId: string;
  title: string;
  priceInPaise: number;
  coverImageKey: string | null;
}) {
  const { inCart, add } = useAddToCart({ productId, title, priceInPaise, coverImageKey });

  return (
    <button
      onClick={add}
      disabled={inCart}
      className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white font-medium px-6 py-3 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      {inCart ? "In cart" : "Add to cart"}
    </button>
  );
}
