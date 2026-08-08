import { getOrderService } from "@/lib/services/orders/OrderService";
import { getStorageService } from "@/lib/services/storage";
import { applyWatermark } from "@/lib/services/watermark/PdfWatermarkService";

const SIGNED_URL_EXPIRY_SECONDS = 300;

export type ResolvedDownload =
  | { mode: "buffer"; buffer: Buffer; fileName: string }
  | { mode: "redirect"; url: string };

/**
 * Owns the full "token -> bytes the buyer actually receives" pipeline —
 * the one seam the route handler talks to. It never touches pdf-lib or
 * an SDK directly, only OrderService (token/buyer/order lookup),
 * StorageService (read/save/exists/getSignedUrl) and PdfWatermarkService
 * (pure bytes-in/bytes-out). A watermarked copy is generated once per
 * order item and cached in storage under its own key — every download
 * after the first is a cache hit (an `exists` HEAD check, not a body
 * fetch), so a buyer re-downloading their receipt doesn't re-run pdf-lib.
 */
export class DownloadService {
  private storage = getStorageService();

  async resolveDownload(token: string): Promise<ResolvedDownload> {
    const { product, order, orderItemId } = await getOrderService().redeemDownloadToken(token);
    const watermarkKey = this.watermarkedKey(order.id, orderItemId);
    const isLocal = (process.env.STORAGE_DRIVER || "local") === "local";

    let freshBuffer: Buffer | null = null;
    if (!(await this.storage.exists(watermarkKey))) {
      freshBuffer = await this.generateAndCache(watermarkKey, product, order);
    }

    if (isLocal) {
      const buffer = freshBuffer ?? (await this.storage.read(watermarkKey));
      return { mode: "buffer", buffer, fileName: product.fileName };
    }

    const url = await this.storage.getSignedUrl(watermarkKey, SIGNED_URL_EXPIRY_SECONDS, product.fileName);
    return { mode: "redirect", url };
  }

  private async generateAndCache(
    watermarkKey: string,
    product: { fileKey: string },
    order: { id: string; orderNumber: number; buyerName: string; buyerEmail: string }
  ): Promise<Buffer> {
    const original = await this.storage.read(product.fileKey);

    let watermarked: Buffer;
    try {
      watermarked = await applyWatermark(original, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
      });
    } catch (err) {
      console.error(`[download] watermarking failed for order ${order.id}:`, err);
      throw new Error("We couldn't prepare your download right now — please try again in a moment");
    }

    await this.storage.save(watermarkKey, watermarked);
    return watermarked;
  }

  /**
   * Scoped by orderId AND orderItemId, not just orderId — an order can
   * contain multiple products (see the cart/checkout flow), each with a
   * distinct original file and its own token, so each needs its own
   * cached watermarked copy. Still never shared across orders/buyers,
   * which is the property that actually matters.
   */
  private watermarkedKey(orderId: string, orderItemId: string): string {
    return `watermarked/${orderId}/${orderItemId}.pdf`;
  }
}

export function getDownloadService() {
  return new DownloadService();
}
