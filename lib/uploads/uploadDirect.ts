export interface DirectUploadResult {
  key: string;
  fileName: string;
}

/**
 * Uploads a File straight to storage (R2 in production, a local proxy in
 * dev) via a presigned URL, bypassing our own server for the file bytes —
 * Vercel caps function request bodies at 4.5MB, which large PDFs exceed.
 */
export async function uploadDirect(file: File, kind: "file" | "cover"): Promise<DirectUploadResult> {
  const presignRes = await fetch("/api/products/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, kind }),
  });
  if (!presignRes.ok) {
    const data = await presignRes.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" ? data.error : "Could not prepare upload");
  }
  const { key, uploadUrl } = (await presignRes.json()) as { key: string; uploadUrl: string };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Could not upload ${kind === "file" ? "PDF" : "cover image"} — please try again`);
  }

  return { key, fileName: file.name };
}
