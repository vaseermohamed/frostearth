import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getStorageService } from "@/lib/services/storage";
import { sanitizeFileName } from "@/lib/services/products/ProductService";

const UPLOAD_URL_EXPIRY_SECONDS = 300;

/**
 * Hands the browser a URL it can PUT a file straight to (R2 in production,
 * a local proxy route in dev) so file bytes never pass through a Vercel
 * function — Vercel hard-caps request bodies at 4.5MB, which large scanned
 * PDFs blow past. The client only ever gets a URL back; the storage key
 * itself is decided here, server-side, so it can never be spoofed.
 */
export async function POST(req: NextRequest) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const kind = body?.kind;

  if (!fileName || !contentType || (kind !== "file" && kind !== "cover")) {
    return NextResponse.json(
      { error: "fileName, contentType and kind ('file' | 'cover') are required" },
      { status: 400 }
    );
  }
  // fileName lands directly in a storage key (see sanitizeFileName below) —
  // S3/R2 keys are capped at 1024 bytes, and no real filename needs to be
  // anywhere close to this.
  if (fileName.length > 200) {
    return NextResponse.json({ error: "File name is too long" }, { status: 400 });
  }
  if (kind === "file" && contentType !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported for the product file" }, { status: 400 });
  }
  if (kind === "cover" && !contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Cover image must be an image file" }, { status: 400 });
  }

  const prefix = kind === "file" ? "products" : "covers";
  const key = `${prefix}/${session.storeId}/${uuid()}-${sanitizeFileName(fileName)}`;

  const uploadUrl = await getStorageService().getUploadUrl(key, contentType, UPLOAD_URL_EXPIRY_SECONDS);

  return NextResponse.json({ key, uploadUrl });
}
