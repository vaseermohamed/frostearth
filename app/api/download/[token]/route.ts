import { NextRequest, NextResponse } from "next/server";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { getStorageService } from "@/lib/services/storage";

/**
 * The only path a paid buyer's PDF is ever served through. Every request
 * re-checks token validity, order status, expiry and use-count — nothing
 * about "having the link" is trusted beyond that.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const product = await getOrderService().redeemDownloadToken(params.token);
    const storage = getStorageService();
    const buffer = await storage.read(product.fileKey);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${product.fileName}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Download link invalid" }, { status: 403 });
  }
}
