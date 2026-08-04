"use client";

import { useCart } from "@/lib/cart/CartContext";

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
  const { items, addItem } = useCart();
  const inCart = items.some((i) => i.productId === productId);

  return (
    <button
      onClick={() => addItem({ productId, title, priceInPaise, coverImageKey })}
      disabled={inCart}
      className="bg-clay-500 hover:opacity-90 text-white font-medium rounded-md px-5 py-2.5 disabled:opacity-60"
    >
      {inCart ? "In cart" : "Add to cart"}
    </button>
  );
}
