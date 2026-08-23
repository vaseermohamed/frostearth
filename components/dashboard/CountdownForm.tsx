"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CountdownFormValues {
  examName: string;
  label: string;
  targetDateTime: string; // raw <input type="datetime-local"> value, IST wall-clock
  isActive: boolean;
  displayOrder: number;
}

const EMPTY: CountdownFormValues = {
  examName: "",
  label: "Registration closes in",
  targetDateTime: "",
  isActive: true,
  displayOrder: 0,
};

export default function CountdownForm({
  countdownId,
  initial,
}: {
  countdownId?: string;
  initial?: CountdownFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CountdownFormValues>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const url = countdownId ? `/api/countdowns/${countdownId}` : "/api/countdowns";
    const method = countdownId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);

    if (res.ok) {
      router.push("/dashboard/countdowns");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Could not save countdown");
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-fog p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Exam name</label>
        <input
          required
          value={values.examName}
          onChange={(e) => setValues({ ...values, examName: e.target.value })}
          placeholder="TNPSC Group 2"
          className="w-full rounded-md border border-fog px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          required
          value={values.label}
          onChange={(e) => setValues({ ...values, label: e.target.value })}
          placeholder="Registration closes in"
          className="w-full rounded-md border border-fog px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Target date &amp; time (IST)</label>
        <input
          required
          type="datetime-local"
          value={values.targetDateTime}
          onChange={(e) => setValues({ ...values, targetDateTime: e.target.value })}
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
        <p className="text-xs text-slate mt-1">Lower numbers appear first in the carousel.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues({ ...values, isActive: e.target.checked })}
        />
        Active (shown on the homepage carousel)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white font-medium px-4 py-2 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save countdown"}
      </button>
    </form>
  );
}
