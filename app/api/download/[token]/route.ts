import { NextRequest, NextResponse } from "next/server";
import { getDownloadService } from "@/lib/services/download/DownloadService";
import { attachmentContentDisposition } from "@/lib/utils/contentDisposition";

/**
 * The only path a paid buyer's PDF is ever served through. Every request
 * re-checks token validity, order status, expiry and use-count — nothing
 * about "having the link" is trusted beyond that (see
 * OrderService.redeemDownloadToken) — and every file that leaves here is
 * watermarked fresh with that buyer's identity (see DownloadService /
 * PdfWatermarkService), never the original stored file directly, and
 * never a persisted copy either — DownloadService reads the original,
 * watermarks it in memory, and this route streams the result straight
 * into the response. Nothing watermarked is ever written back to
 * storage, so there's no per-order cached file for anything to clean up.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { buffer, fileName } = await getDownloadService().resolveDownload(params.token);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": attachmentContentDisposition(fileName),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Download link invalid" }, { status: 403 });
  }
}
