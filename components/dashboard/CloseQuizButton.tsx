"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseQuizButton({ quizId, quizTitle }: { quizId: string; quizTitle: string }) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    if (
      !window.confirm(
        `Close "${quizTitle}"? This stops new entries immediately. The sorted entries list becomes the final winner list — this can't be undone.`,
      )
    )
      return;

    setClosing(true);
    const res = await fetch(`/api/quizzes/${quizId}/close`, { method: "POST" });
    setClosing(false);

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(typeof data.error === "string" ? data.error : "Could not close this quiz. Try again.");
    }
  }

  return (
    <button
      onClick={handleClose}
      disabled={closing}
      className="rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium px-4 py-2 disabled:opacity-60"
    >
      {closing ? "Closing…" : "Close quiz"}
    </button>
  );
}
