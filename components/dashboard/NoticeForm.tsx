"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface NoticeFormValues {
  title: string;
  publishedDate: string; // raw <input type="date"> value, IST calendar date
  isActive: boolean;
  displayOrder: number;
}

const EMPTY: NoticeFormValues = {
  title: "",
  publishedDate: "",
  isActive: true,
  displayOrder: 0,
};

export default function NoticeForm({ noticeId, initial }: { noticeId?: string; initial?: NoticeFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState<NoticeFormValues>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const url = noticeId ? `/api/notices/${noticeId}` : "/api/notices";
    const method = noticeId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);

    if (res.ok) {
      router.push("/dashboard/notices");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Could not save notice");
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-fog p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          required
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
          placeholder="Hall tickets released for TNPSC Group 4"
          className="w-full rounded-md border border-fog px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Published date</label>
        <input
          required
          type="date"
          value={values.publishedDate}
          onChange={(e) => setValues({ ...values, publishedDate: e.target.value })}
          className="w-full rounded-md border border-fog px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Display order</label>
        <input
          type="number"
          min={0}
          value={values.displayOrder}
          onChange={(e) => setValues({ ...values, displayOrder: Number(e.target.value) })}
          className="w-full rounded-md border border-fog px-3 py-2"
        />
        <p className="text-xs text-slate mt-1">Lower numbers appear first on the notice board.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues({ ...values, isActive: e.target.checked })}
        />
        Active (shown on the homepage notice board)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white font-medium px-4 py-2 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save notice"}
      </button>
    </form>
  );
}
