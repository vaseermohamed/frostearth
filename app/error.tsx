"use client";

import { useEffect } from "react";

/**
 * Root fallback — catches anything an unexpected exception in a server
 * component would otherwise turn into Next's generic, unstyled error page.
 * Nested (dashboard)/error.tsx and c/[slug]/error.tsx take priority for
 * their subtrees; this only fires for routes outside both (e.g. /login).
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="max-w-sm text-center">
        <h1 className="font-display font-black text-2xl text-ink mb-2">Something went wrong</h1>
        <p className="text-sm text-slate mb-8">
          An unexpected error occurred. Please try again — if it keeps happening, let us know.
        </p>
        <button
          onClick={reset}
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-5 py-2.5"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
