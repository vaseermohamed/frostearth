"use client";

import { useAddToCart } from "@/lib/cart/useAddToCart";

/**
 * Overlay "+" button on a storefront grid tile — lets a buyer add to cart
 * without opening the product page. Rendered as a SIBLING of the tile's
 * <Link>, never nested inside it (nested interactive elements are invalid
 * HTML and break keyboard/screen-reader navigation), so clicks here must
 * stop propagation to avoid also triggering the Link underneath.
 */
export default function QuickAddButton({
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
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        add();
      }}
      disabled={inCart}
      aria-label={inCart ? `${title} is in your cart` : `Add ${title} to cart`}
      className="absolute top-3 right-3 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-ink text-paper border-2 border-white shadow-md hover:bg-ink/85 transition-colors disabled:opacity-70 disabled:hover:bg-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-frost focus-visible:ring-offset-2"
    >
      {inCart ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </button>
  );
}
