"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteProductButton({
  productId,
  productTitle,
}: {
  productId: string;
  productTitle: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${productTitle}"? If it has never sold, this removes it and its file permanently. If it has past orders, it will be archived instead (kept for your records).`
    );
    if (!confirmed) return;

    setDeleting(true);
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);

    if (res.ok) {
      if (data.hardDeleted === false) {
        alert(`"${productTitle}" has past orders, so it can't be permanently deleted — it's been archived instead. You'll find it under Archive.`);
      }
      router.refresh();
    } else {
      alert(typeof data.error === "string" ? data.error : "Could not delete this product. Try again.");
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-red-600 hover:text-red-800 disabled:opacity-60"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
