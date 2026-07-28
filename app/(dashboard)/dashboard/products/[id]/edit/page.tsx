"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Product {
  id: string;
  title: string;
  description: string;
  priceInPaise: number;
  status: "DRAFT" | "PUBLISHED";
  fileName: string;
}

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setProduct(data.product))
      .catch(() => setNotFound(true));
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    // priceInPaise is derived from the rupee input, same pattern as the create form
    const rupees = form.get("priceRupees");
    if (rupees) form.set("priceInPaise", String(Math.round(Number(rupees) * 100)));
    form.delete("priceRupees");

    const res = await fetch(`/api/products/${params.id}`, { method: "PATCH", body: form });
    setLoading(false);

    if (res.ok) {
      router.push("/dashboard/products");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save changes");
    }
  }

  if (notFound) return <p className="text-frost-500">Product not found.</p>;
  if (!product) return <p className="text-frost-500">Loading…</p>;

  return (
    <div className="max-w-lg">
      <Link href="/dashboard/products" className="inline-flex items-center gap-1 text-sm text-frost-500 hover:text-frost-900 mb-4">
        ← Back to products
      </Link>
      <h1 className="text-2xl font-semibold mb-6">Edit product</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-frost-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            name="title"
            required
            defaultValue={product.title}
            className="w-full rounded-md border border-frost-100 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            required
            rows={4}
            defaultValue={product.description}
            className="w-full rounded-md border border-frost-100 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Price (₹)</label>
          <input
            name="priceRupees"
            type="number"
            min={1}
            step="1"
            required
            defaultValue={product.priceInPaise / 100}
            className="w-full rounded-md border border-frost-100 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            name="status"
            defaultValue={product.status}
            className="w-full rounded-md border border-frost-100 px-3 py-2"
          >
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft (hidden from storefront)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Replace PDF <span className="text-frost-500 font-normal">(current: {product.fileName} — leave blank to keep it)</span>
          </label>
          <input name="file" type="file" accept="application/pdf" className="w-full text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Replace cover image <span className="text-frost-500 font-normal">(leave blank to keep current)</span>
          </label>
          <input name="cover" type="file" accept="image/*" className="w-full text-sm" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-frost-500 hover:bg-frost-600 text-white font-medium rounded-md px-4 py-2 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
