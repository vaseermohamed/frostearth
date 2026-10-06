import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getDownloadService } from "@/lib/services/download/DownloadService";
import { attachmentContentDisposition } from "@/lib/utils/contentDisposition";

/**
 * Creator-only manual retrieval of a purchased file, for handing it
 * directly to a struggling buyer (email/WhatsApp) independent of their
 * own download link — same watermarked-with-buyer-identity output as
 * app/api/download/[token]/route.ts (same DownloadService pipeline,
 * same PdfWatermarkService data), but reached via the dashboard session
 * instead of a DownloadToken, and never touches that token: no expiry
 * check, no usedCount increment (see OrderService.getItemForAdminDownload).
 * Gated by the exact same session check as every other /api/products or
 * /api/orders dashboard route — unreachable without a valid creator login.
 */
export async function GET(_req: NextRequest, { params }: { params: { orderId: string; orderItemId: string } }) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const { buffer, fileName } = await getDownloadService().resolveAdminDownload(
      session.storeId,
      params.orderId,
      params.orderItemId,
    );
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": attachmentContentDisposition(fileName),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not retrieve file" }, { status: 400 });
  }
}
