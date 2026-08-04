import { prisma } from "@/lib/db/prisma";
import { getPaymentService } from "@/lib/services/payment";
import { getEmailService } from "@/lib/services/email";
import { v4 as uuid } from "uuid";

const DOWNLOAD_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days
const DOWNLOAD_TOKEN_MAX_USES = 10;

/**
 * Owns the PENDING -> PAID/FAILED lifecycle for cart checkouts (one or
 * more products per order) and per-item download-token issuance. Never
 * trusts the browser: an order only becomes PAID after a verified
 * Razorpay signature (checkout callback and/or webhook).
 */
export class OrderService {
  private payment = getPaymentService();
  private email = getEmailService();

  /**
   * Creates a PENDING order covering every productId in the cart.
   * Prices are snapshotted from the Product table right now — later
   * edits to a product's price never retroactively change a past sale.
   */
  async createPendingOrder(
    productIds: string[],
    buyerName: string,
    buyerEmail: string,
    buyerPhone?: string
  ) {
    const uniqueIds = Array.from(new Set(productIds));
    if (uniqueIds.length === 0) throw new Error("Cart is empty");

    const products = await prisma.product.findMany({
      where: { id: { in: uniqueIds }, status: "PUBLISHED" },
    });
    if (products.length !== uniqueIds.length) {
      throw new Error("One or more items in your cart are no longer available");
    }

    // All items in a cart must belong to the same store — the MVP only
    // has one store so this always passes, but the check matters once
    // creator #2 exists (a cart can't mix two tenants' products).
    const storeId = products[0].storeId;
    if (!products.every((p) => p.storeId === storeId)) {
      throw new Error("Cart items must be from the same store");
    }

    const amountInPaise = products.reduce((sum, p) => sum + p.priceInPaise, 0);

    const providerOrder = await this.payment.createOrder({
      amountInPaise,
      receipt: uuid(), // Razorpay caps `receipt` at 40 chars — a bare uuid (36) fits
    });

    const order = await prisma.order.create({
      data: {
        storeId,
        buyerName,
        buyerEmail,
        buyerPhone,
        amountInPaise,
        status: "PENDING",
        razorpayOrderId: providerOrder.providerOrderId,
        items: {
          create: products.map((p) => ({
            productId: p.id,
            titleSnapshot: p.title,
            priceInPaiseSnapshot: p.priceInPaise,
          })),
        },
      },
      include: { items: true },
    });

    return order;
  }

  verifyCheckoutSignature(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    return this.payment.verifyCheckoutSignature(params);
  }

  /**
   * Confirmation path #1: the Razorpay webhook. Authoritative in
   * production — fires even if the buyer closes the tab before the
   * checkout modal's own callback runs.
   */
  async confirmWebhookPayment(rawBody: string, signatureHeader: string) {
    const valid = this.payment.verifyWebhookSignature({ rawBody, signatureHeader });
    if (!valid) throw new Error("Invalid webhook signature");

    const event = this.payment.parseWebhookEvent(rawBody);
    return this.markPaidByRazorpayOrderId(
      event.providerOrderId,
      event.providerPaymentId,
      event.status === "captured"
    );
  }

  /**
   * Confirmation path #2: the checkout modal's own signed callback —
   * cryptographic proof from Razorpay, not "trust the client". Lets the
   * buyer see their downloads instantly instead of waiting on a webhook
   * round trip; the webhook still reconciles anything this path misses.
   */
  async confirmClientCheckout(params: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const valid = this.payment.verifyCheckoutSignature({
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      razorpaySignature: params.razorpaySignature,
    });
    if (!valid) throw new Error("Invalid payment signature");

    return this.markPaidByRazorpayOrderId(params.razorpayOrderId, params.razorpayPaymentId, true);
  }

  private async markPaidByRazorpayOrderId(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    captured: boolean
  ) {
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
      include: { items: true },
    });
    if (!order) throw new Error(`No order for razorpay order ${razorpayOrderId}`);

    if (order.status === "PAID") return order; // idempotent — both confirmation paths may call this

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: captured ? "PAID" : "FAILED",
        razorpayPaymentId,
      },
      include: { items: true },
    });

    if (updated.status === "PAID") {
      const tokens: { title: string; token: string }[] = [];
      for (const item of updated.items) {
        const dt = await this.issueDownloadToken(item.id);
        tokens.push({ title: item.titleSnapshot, token: dt.token });
      }
      await this.sendReceiptEmail(updated.buyerEmail, updated.orderNumber, tokens);
    }

    return updated;
  }

  /**
   * Best-effort — a failed email must never fail the checkout itself,
   * since the buyer already has working download links on-screen from
   * the client-confirmation path. EmailService swallows its own errors
   * (see ResendEmailService) for the same reason.
   */
  private async sendReceiptEmail(
    to: string,
    orderNumber: number,
    tokens: { title: string; token: string }[]
  ) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const linksHtml = tokens
      .map(
        (t) =>
          `<li><a href="${appUrl}/api/download/${t.token}">${escapeHtml(t.title)}</a></li>`
      )
      .join("");

    try {
      await this.email.send({
        to,
        subject: `Order #${orderNumber} — your FrostEarth download links`,
        html: `<p>Thanks for your purchase! Order <strong>#${orderNumber}</strong>. Here ${tokens.length > 1 ? "are your files" : "is your file"}:</p><ul>${linksHtml}</ul><p>These links expire in 3 days.</p>`,
      });
    } catch (err) {
      console.error("[order] sendReceiptEmail failed:", err);
    }
  }

  async issueDownloadToken(orderItemId: string) {
    const token = uuid();
    return prisma.downloadToken.create({
      data: {
        orderItemId,
        token,
        expiresAt: new Date(Date.now() + DOWNLOAD_TOKEN_TTL_SECONDS * 1000),
      },
    });
  }

  /** Every download token issued for a given order — used to hand the buyer all their links after payment. */
  async getDownloadTokensForOrder(orderId: string) {
    return prisma.downloadToken.findMany({
      where: { orderItem: { orderId } },
      include: { orderItem: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async listForStore(storeId: string) {
    return prisma.order.findMany({
      where: { storeId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Resolves a download token to file bytes, enforcing expiry + use-count + paid status. */
  async redeemDownloadToken(token: string) {
    const record = await prisma.downloadToken.findUnique({
      where: { token },
      include: { orderItem: { include: { product: true, order: true } } },
    });
    if (!record) throw new Error("Invalid download link");
    if (record.orderItem.order.status !== "PAID") throw new Error("Order not paid");
    if (record.expiresAt < new Date()) throw new Error("Download link expired");
    if (record.usedCount >= DOWNLOAD_TOKEN_MAX_USES) throw new Error("Download link exhausted");

    await prisma.downloadToken.update({
      where: { id: record.id },
      data: { usedCount: { increment: 1 } },
    });

    return record.orderItem.product;
  }
}

export function getOrderService() {
  return new OrderService();
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
