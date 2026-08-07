"use client";

import { useEffect } from "react";

/**
 * Storefront/checkout error boundary — a buyer mid-purchase who hits an
 * unexpected server error should see a clear, reassuring message, not
 * Next's generic error page, especially since this segment covers the
 * cart and payment flow.
 */
export default function StorefrontError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[storefront] unhandled error:", error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 sm:py-24 text-center">
      <h1 className="font-display font-black text-2xl text-ink mb-2">Something went wrong</h1>
      <p className="text-sm text-slate mb-8 max-w-sm mx-auto">
        We hit an unexpected error loading this page. Nothing was charged. Please try again.
      </p>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={reset}
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-5 py-2.5"
        >
          Try again
        </button>
        <a href="/" className="text-sm text-ink underline">
          Back to store
        </a>
      </div>
    </div>
  );
}
