import { NextRequest, NextResponse } from "next/server";
import { getStorageService } from "@/lib/services/storage";

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Was hardcoded to "image/jpeg" regardless of the actual uploaded file —
 * wrong for every PNG cover (browsers mostly content-sniff around it, but
 * it was still a real mislabel). Derived from the key's own extension
 * instead, since product/upload-url/route.ts always preserves the
 * original filename's extension in the key it mints. Falls back to
 * application/octet-stream for anything unrecognized rather than lying
 * about the type.
 */
function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Serves ONLY cover images. Product files (the paid PDF) are never
 * reachable through this route — that's the entire point of keeping
 * fileKey separate from coverImageKey and only resolving fileKey via
 * /api/download/[token] after a paid-order check.
 *
 * `immutable` is safe here specifically because a cover's storage key is
 * never overwritten in place: /api/products/upload-url mints a fresh
 * uuid()-prefixed key on every upload (new product or cover replacement
 * alike — see ProductService.update, which deletes the OLD key after
 * swapping the product's pointer to a NEW one, and never writes to an
 * existing key again). A given key's bytes are therefore fixed for its
 * entire lifetime, so a client/CDN caching it forever is correct, not
 * stale-risk — the URL changes instead of the content underneath it.
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
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
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
  try {
    await getStorageService().save(key, buffer);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Covers LocalFsStorageService's path-traversal guard throwing on a
    // crafted key, plus any other disk-write failure — must not surface
    // as a raw 500.
    console.error("[storage] save failed:", err);
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }
}
