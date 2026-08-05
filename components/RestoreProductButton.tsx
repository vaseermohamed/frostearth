"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Restores an archived product to DRAFT — deliberately DRAFT, not
 * PUBLISHED, so the creator has to actively re-publish rather than have
 * it silently go live again. Reuses the existing product PATCH endpoint
 * (and its auth/ownership checks) instead of a separate restore route.
 */
export default function RestoreProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);

  async function handleRestore() {
    setRestoring(true);
    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT" }),
    });
    const data = await res.json().catch(() => ({}));
    setRestoring(false);

    if (res.ok) {
      router.refresh();
    } else {
      alert(typeof data.error === "string" ? data.error : "Could not restore this product. Try again.");
    }
  }

  return (
    <button
      onClick={handleRestore}
      disabled={restoring}
      className="text-sm text-frost hover:opacity-80 transition-opacity disabled:opacity-60"
    >
      {restoring ? "Restoring…" : "Restore"}
    </button>
  );
}
