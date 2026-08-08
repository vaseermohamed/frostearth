import { NextRequest, NextResponse } from "next/server";
import { getDownloadService } from "@/lib/services/download/DownloadService";

/**
 * The only path a paid buyer's PDF is ever served through. Every request
 * re-checks token validity, order status, expiry and use-count — nothing
 * about "having the link" is trusted beyond that (see
 * OrderService.redeemDownloadToken) — and every file that leaves here is
 * watermarked with that buyer's identity (see DownloadService /
 * PdfWatermarkService), never the original stored file directly.
 *
 * On R2, once a watermarked copy exists (cached after the first
 * download), the buyer is redirected straight to a short-lived presigned
 * URL for THAT copy — the file flows R2 -> browser directly instead of
 * being buffered through this function. Local dev has no real presigned
 * URLs (LocalFsStorageService.getSignedUrl just points at a proxy route),
 * and that proxy route deliberately refuses to serve product files
 * directly — see app/api/storage/[...key]/route.ts, which only serves
 * keys under covers/. So local dev keeps the original buffer-and-stream
 * behavior: files are small there and it was never the bottleneck.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const result = await getDownloadService().resolveDownload(params.token);

    if (result.mode === "redirect") {
      return NextResponse.redirect(result.url, 307);
    }
    return new NextResponse(result.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Download link invalid" }, { status: 403 });
  }
}
