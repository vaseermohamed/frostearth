import { NextRequest, NextResponse } from "next/server";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { getStorageService } from "@/lib/services/storage";

const SIGNED_URL_EXPIRY_SECONDS = 300;

/**
 * The only path a paid buyer's PDF is ever served through. Every request
 * re-checks token validity, order status, expiry and use-count — nothing
 * about "having the link" is trusted beyond that (see
 * OrderService.redeemDownloadToken).
 *
 * On R2, once the token checks out, the buyer is redirected straight to a
 * short-lived presigned URL — the file flows R2 -> browser directly
 * instead of being buffered through this function first. These PDFs run
 * up to tens of MB; buffering them here doubled the network hop (R2 ->
 * function -> browser) and burned function time/memory for nothing.
 *
 * Local dev has no real presigned URLs (LocalFsStorageService.getSignedUrl
 * just points at a proxy route) and that proxy route deliberately refuses
 * to serve product files directly — see app/api/storage/[...key]/route.ts,
 * which only serves keys under covers/. So local dev keeps the original
 * buffer-and-stream behavior: files are small there and it was never the
 * bottleneck.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const product = await getOrderService().redeemDownloadToken(params.token);
    const storage = getStorageService();

    if ((process.env.STORAGE_DRIVER || "local") === "local") {
      const buffer = await storage.read(product.fileKey);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${product.fileName}"`,
        },
      });
    }

    const signedUrl = await storage.getSignedUrl(product.fileKey, SIGNED_URL_EXPIRY_SECONDS, product.fileName);
    return NextResponse.redirect(signedUrl, 307);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Download link invalid" }, { status: 403 });
  }
}
