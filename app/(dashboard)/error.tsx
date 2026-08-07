"use client";

import { useEffect } from "react";

/**
 * Dashboard-wide error boundary. A crash here is still real downtime for
 * the person running the business, even though only the creator sees it —
 * this replaces Next's generic error page with a specific, on-brand
 * message and a way back to a known-good screen, same standard as any
 * buyer-facing surface.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard] unhandled error:", error);
  }, [error]);

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-2">This page hit an error</h1>
      <p className="text-sm text-slate mb-6">
        Something went wrong loading this page. This has been logged — try again, or head back to the dashboard.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-4 py-2"
        >
          Try again
        </button>
        <a href="/dashboard" className="text-sm text-slate hover:text-ink transition-colors">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
