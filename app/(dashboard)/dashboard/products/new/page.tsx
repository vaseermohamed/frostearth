"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProductPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/products", { method: "POST", body: form });
    setLoading(false);

    if (res.ok) {
      router.push("/dashboard/products");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not upload product");
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Upload a product</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-frost-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input name="title" required className="w-full rounded-md border border-frost-100 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea name="description" required rows={4} className="w-full rounded-md border border-frost-100 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Price (₹)</label>
          <input
            name="priceInPaiseRupees"
            type="number"
            min={1}
            step="1"
            required
            className="w-full rounded-md border border-frost-100 px-3 py-2"
            onChange={(e) => {
              const hidden = e.currentTarget.form?.elements.namedItem("priceInPaise") as HTMLInputElement;
              if (hidden) hidden.value = String(Math.round(Number(e.currentTarget.value) * 100));
            }}
          />
          <input type="hidden" name="priceInPaise" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PDF file</label>
          <input name="file" type="file" accept="application/pdf" required className="w-full text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cover image (optional)</label>
          <input name="cover" type="file" accept="image/*" className="w-full text-sm" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-frost-500 hover:bg-frost-600 text-white font-medium rounded-md px-4 py-2 disabled:opacity-60"
        >
          {loading ? "Uploading…" : "Publish product"}
        </button>
      </form>
    </div>
  );
}
