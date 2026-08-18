import { getOrderService } from "@/lib/services/orders/OrderService";
import { getStorageService } from "@/lib/services/storage";
import { applyWatermark } from "@/lib/services/watermark/PdfWatermarkService";

export interface ResolvedDownload {
  buffer: Buffer;
  fileName: string;
}

/**
 * Owns the full "token -> bytes the buyer actually receives" pipeline —
 * the one seam the route handler talks to. It never touches pdf-lib or
 * an SDK directly, only OrderService (token/buyer/order lookup),
 * StorageService (read-only, for the original file) and
 * PdfWatermarkService (pure bytes-in/bytes-out).
 *
 * Deliberately NOT cached. An earlier version cached one watermarked
 * copy per order item in R2 (keyed by orderId/orderItemId) so repeat
 * downloads skipped re-running pdf-lib — but every unique paid order
 * produced a new cached file that nothing ever deleted on its own,
 * which is what app/api/cron/cleanup-watermarks/route.ts and
 * scripts/bulk-cleanup-by-date.ts exist to claw back. Generating fresh
 * on every real download click removes the growth at the source: the
 * original stored file is the only thing that ever persists, and
 * nothing watermarked is ever written back to storage. Watermarking a
 * PDF this size costs well under a second (~0.5-0.6s measured against a
 * real 48-page/4.4MB product PDF) — cheap enough that paying it on
 * every download is a better trade than owning a storage-growth
 * problem.
 */
interface WatermarkSourceProduct {
  fileKey: string;
  fileName: string;
}

interface WatermarkSourceOrder {
  id: string;
  orderNumber: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
}

export class DownloadService {
  private storage = getStorageService();

  async resolveDownload(token: string): Promise<ResolvedDownload> {
    const { product, order } = await getOrderService().redeemDownloadToken(token);
    return this.generateWatermarkedDownload(product, order);
  }

  /**
   * Creator-initiated download from the dashboard order detail page —
   * same watermarked bytes a buyer would get (same data source, same
   * traceability), but reached via an authenticated dashboard session
   * instead of a DownloadToken. See
   * OrderService.getItemForAdminDownload for why this never touches the
   * buyer's own token/use-count.
   */
  async resolveAdminDownload(storeId: string, orderId: string, orderItemId: string): Promise<ResolvedDownload> {
    const { product, order } = await getOrderService().getItemForAdminDownload(storeId, orderId, orderItemId);
    return this.generateWatermarkedDownload(product, order);
  }

  private async generateWatermarkedDownload(
    product: WatermarkSourceProduct,
    order: WatermarkSourceOrder
  ): Promise<ResolvedDownload> {
    const original = await this.storage.read(product.fileKey);

    let watermarked: Buffer;
    try {
      watermarked = await applyWatermark(original, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        buyerPhone: order.buyerPhone,
      });
    } catch (err) {
      console.error(`[download] watermarking failed for order ${order.id}:`, err);
      throw new Error("We couldn't prepare this download right now — please try again in a moment");
    }

    return { buffer: watermarked, fileName: product.fileName };
  }
}

export function getDownloadService() {
  return new DownloadService();
}
