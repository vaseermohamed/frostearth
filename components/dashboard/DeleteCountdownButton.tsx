"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCountdownButton({ countdownId, examName }: { countdownId: string; examName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete the "${examName}" countdown? This can't be undone.`)) return;

    setDeleting(true);
    const res = await fetch(`/api/countdowns/${countdownId}`, { method: "DELETE" });
    setDeleting(false);

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(typeof data.error === "string" ? data.error : "Could not delete this countdown. Try again.");
    }
  }

  return (
    <button onClick={handleDelete} disabled={deleting} className="text-red-600 hover:text-red-800 disabled:opacity-60">
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
