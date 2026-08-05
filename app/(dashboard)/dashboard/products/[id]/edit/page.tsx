"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { uploadDirect } from "@/lib/uploads/uploadDirect";

interface Product {
  id: string;
  title: string;
  description: string;
  priceInPaise: number;
  status: "DRAFT" | "PUBLISHED";
  fileName: string;
}

type Stage = "idle" | "uploading" | "saving";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
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

    const form = new FormData(e.currentTarget);
    const title = form.get("title");
    const description = form.get("description");
    const rupees = form.get("priceRupees");
    const priceInPaise = rupees ? Math.round(Number(rupees) * 100) : undefined;
    const status = form.get("status");
    const fileInput = form.get("file");
    const coverInput = form.get("cover");

    try {
      setStage("uploading");
      const uploadedFile =
        fileInput instanceof File && fileInput.size > 0 ? await uploadDirect(fileInput, "file") : undefined;
      const uploadedCover =
        coverInput instanceof File && coverInput.size > 0 ? await uploadDirect(coverInput, "cover") : undefined;

      setStage("saving");
      const res = await fetch(`/api/products/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priceInPaise,
          status,
          fileKey: uploadedFile?.key,
          fileName: uploadedFile?.fileName,
          coverImageKey: uploadedCover?.key,
        }),
      });

      if (res.ok) {
        router.push("/dashboard/products");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save changes");
    } catch (err: any) {
      setError(err.message || "Could not save changes");
    } finally {
      setStage("idle");
    }
  }

  if (notFound) return <p className="text-slate">Product not found.</p>;
  if (!product) return <p className="text-slate">Loading…</p>;

  const loading = stage !== "idle";
  const buttonLabel = stage === "uploading" ? "Uploading PDF…" : stage === "saving" ? "Saving product…" : "Save changes";

  return (
    <div className="max-w-lg">
      <Link href="/dashboard/products" className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4">
        ← Back to products
      </Link>
      <h1 className="text-2xl font-semibold mb-6">Edit product</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-fog p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            name="title"
            required
            defaultValue={product.title}
            className="w-full rounded-md border border-fog px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            required
            rows={4}
            defaultValue={product.description}
            className="w-full rounded-md border border-fog px-3 py-2"
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
            className="w-full rounded-md border border-fog px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            name="status"
            defaultValue={product.status}
            className="w-full rounded-md border border-fog px-3 py-2"
          >
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft (hidden from storefront)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Replace PDF <span className="text-slate font-normal">(current: {product.fileName} — leave blank to keep it)</span>
          </label>
          <input name="file" type="file" accept="application/pdf" className="w-full text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Replace cover image <span className="text-slate font-normal">(leave blank to keep current)</span>
          </label>
          <input name="cover" type="file" accept="image/*" className="w-full text-sm" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white font-medium px-4 py-2 disabled:opacity-60"
          >
            {buttonLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
