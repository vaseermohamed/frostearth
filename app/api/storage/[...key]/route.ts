import { NextRequest, NextResponse } from "next/server";
import { getStorageService } from "@/lib/services/storage";

/**
 * Serves ONLY cover images. Product files (the paid PDF) are never
 * reachable through this route — that's the entire point of keeping
 * fileKey separate from coverImageKey and only resolving fileKey via
 * /api/download/[token] after a paid-order check.
 */
export async function GET(_req: NextRequest, { params }: { params: { key: string[] } }) {
  const key = params.key.join("/");
  if (!key.startsWith("covers/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const storage = getStorageService();
    const buffer = await storage.read(key);
    return new NextResponse(buffer, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/**
 * Local-dev-only counterpart to R2's presigned PUT URL. Only reachable when
 * STORAGE_DRIVER=local — production uploads go straight to R2 and never hit
 * this server. Keys are opaque, server-generated UUIDs minted by the
 * authenticated /api/products/upload-url route, so knowledge of this URL is
 * the same authorization boundary a real presigned URL provides.
 */
export async function PUT(req: NextRequest, { params }: { params: { key: string[] } }) {
  if ((process.env.STORAGE_DRIVER || "local") !== "local") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = params.key.join("/");
  if (!key.startsWith("products/") && !key.startsWith("covers/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  await getStorageService().save(key, buffer);
  return NextResponse.json({ ok: true });
}
