"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDirect } from "@/lib/uploads/uploadDirect";

type Stage = "idle" | "uploading" | "saving";

export default function NewProductPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const title = form.get("title");
    const description = form.get("description");
    const priceInPaise = form.get("priceInPaise");
    const fileInput = form.get("file");
    const coverInput = form.get("cover");

    if (!(fileInput instanceof File) || fileInput.size === 0) {
      setError("Product file (PDF) is required");
      return;
    }

    try {
      setStage("uploading");
      const uploadedFile = await uploadDirect(fileInput, "file");
      const uploadedCover =
        coverInput instanceof File && coverInput.size > 0 ? await uploadDirect(coverInput, "cover") : undefined;

      setStage("saving");
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priceInPaise: Number(priceInPaise),
          fileKey: uploadedFile.key,
          fileName: uploadedFile.fileName,
          coverImageKey: uploadedCover?.key,
        }),
      });

      if (res.ok) {
        router.push("/dashboard/products");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save product");
    } catch (err: any) {
      setError(err.message || "Could not upload product");
    } finally {
      setStage("idle");
    }
  }

  const loading = stage !== "idle";
  const buttonLabel = stage === "uploading" ? "Uploading PDF…" : stage === "saving" ? "Saving product…" : "Publish product";

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Upload a product</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-fog p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input name="title" required className="w-full rounded-md border border-fog px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea name="description" required rows={4} className="w-full rounded-md border border-fog px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Price (₹)</label>
          <input
            name="priceInPaiseRupees"
            type="number"
            min={1}
            step="1"
            required
            className="w-full rounded-md border border-fog px-3 py-2"
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
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white font-medium px-4 py-2 disabled:opacity-60"
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  );
}
