"use client";

import { useCart, CartItem } from "@/lib/cart/CartContext";

/**
 * Shared by AddToCartButton (product detail) and QuickAddButton (storefront
 * grid overlay) so both stay in sync with the exact same cart-add logic
 * instead of each reimplementing the "already in cart?" check.
 */
export function useAddToCart(item: CartItem) {
  const { items, addItem } = useCart();
  const inCart = items.some((i) => i.productId === item.productId);
  return { inCart, add: () => addItem(item) };
}
