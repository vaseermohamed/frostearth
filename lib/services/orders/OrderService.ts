import { prisma } from "@/lib/db/prisma";
import { getPaymentService } from "@/lib/services/payment";
import { getEmailService } from "@/lib/services/email";
import { v4 as uuid } from "uuid";
import { formatOrderNumber, formatIstDateTime } from "@/lib/services/orders/orderFilters";

const DOWNLOAD_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days
const DOWNLOAD_TOKEN_MAX_USES = 10;

/**
 * Owns the PENDING -> PAID/FAILED lifecycle for cart checkouts (one or
 * more products per order) and per-item download-token issuance. Never
 * trusts the browser: an order only becomes PAID after a verified
 * Razorpay signature (checkout callback and/or webhook).
 */
export class OrderService {
  // Lazy, not eager: getPaymentService() throws if Razorpay credentials
  // aren't configured, and OrderService is instantiated on pages that
  // never touch payment (dashboard overview/orders, download redemption).
  // Those must keep working even when payment isn't configured yet —
  // only the methods that actually process a payment should be able to
  // fail on missing credentials.
  private get payment() {
    return getPaymentService();
  }
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
      await this.sendReceiptEmail(updated.buyerEmail, updated.buyerName, updated.orderNumber, updated.createdAt, tokens);
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
    buyerName: string,
    orderNumber: number,
    orderDate: Date,
    tokens: { title: string; token: string }[]
  ) {
    const formattedOrderNumber = formatOrderNumber(orderNumber);

    try {
      await this.email.send({
        to,
        subject: `Order ${formattedOrderNumber} — your FrostEarth download links`,
        html: buildReceiptEmailHtml({ buyerName, orderNumber, orderDate, tokens }),
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

  /**
   * `filters` is optional so every existing call site (dashboard overview
   * stats, which wants every order) keeps working unchanged. `status:
   * "FAILED"` matches both FAILED and PENDING orders — the dashboard's
   * on-screen badge already collapses PENDING into "Failed" for display
   * (see StatusBadge in the orders page), so the filter has to match what
   * a creator actually sees, not the raw underlying status.
   */
  async listForStore(
    storeId: string,
    filters: { fromDate?: Date; toDate?: Date; status?: "PAID" | "FAILED"; productId?: string } = {}
  ) {
    const { fromDate, toDate, status, productId } = filters;

    return prisma.order.findMany({
      where: {
        storeId,
        ...(fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(status === "PAID" ? { status: "PAID" as const } : {}),
        ...(status === "FAILED" ? { status: { in: ["FAILED", "PENDING"] as const } } : {}),
        ...(productId ? { items: { some: { productId } } } : {}),
      },
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

/**
 * Table-based layout with everything inlined — email clients don't load
 * external/Tailwind CSS, and many (Outlook especially) only reliably
 * respect layout expressed as nested <table>s rather than flex/grid divs.
 * Archivo won't load in email either, so the header falls back to a bold
 * web-safe sans-serif to approximate the same feel. buyerName and item
 * titles are buyer/creator-supplied strings landing in raw HTML, so both
 * go through escapeHtml — the same protection already applied to titles
 * before this rewrite, just now also covering the buyer's name.
 */
function buildReceiptEmailHtml(params: {
  buyerName: string;
  orderNumber: number;
  orderDate: Date;
  tokens: { title: string; token: string }[];
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const year = new Date().getFullYear();
  const formattedOrderNumber = formatOrderNumber(params.orderNumber);
  const formattedDate = formatIstDateTime(params.orderDate);

  const itemRows = params.tokens
    .map(
      (t) => `
              <tr>
                <td style="padding:0 0 10px 0; font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#0A0A0A;">
                  ${escapeHtml(t.title)}
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 20px 0;">
                  <a href="${appUrl}/api/download/${t.token}" style="display:inline-block; background-color:#2E5C8A; color:#ffffff; font-family:Arial, Helvetica, sans-serif; font-size:13px; font-weight:700; text-decoration:none; padding:10px 22px; border-radius:24px;">Download</a>
                </td>
              </tr>`
    )
    .join("");

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAF8; padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border:1px solid #E8E8E4;">
        <tr>
          <td style="padding:32px 32px 20px 32px;">
            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-weight:700; font-size:22px; letter-spacing:-0.5px; color:#0A0A0A;">FrostEarth</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px 32px; border-bottom:1px solid #E8E8E4;">
            <p style="margin:0 0 6px 0; font-family:Arial, Helvetica, sans-serif; font-size:16px; color:#0A0A0A;">Hi ${escapeHtml(params.buyerName)}, thanks for your order.</p>
            <p style="margin:0; font-family:'Courier New', Courier, monospace; font-size:13px; color:#6B6B68;">Order ${formattedOrderNumber} &middot; ${formattedDate}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;">
            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#6B6B68;">These links expire in 3 days and can be used up to 10 times.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 32px 32px; border-top:1px solid #E8E8E4;">
            <p style="margin:0 0 4px 0; font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#6B6B68;">Questions? Contact us at <a href="mailto:hello@frostearth.in" style="color:#6B6B68;">hello@frostearth.in</a></p>
            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#6B6B68;">&copy; ${year} FrostEarth</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
