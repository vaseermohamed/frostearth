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
