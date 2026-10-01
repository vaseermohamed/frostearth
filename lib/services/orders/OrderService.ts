import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getPaymentService } from "@/lib/services/payment";
import { getEmailService } from "@/lib/services/email";
import { PolicyService, getPolicyService } from "@/lib/services/policies/PolicyService";
import { v4 as uuid } from "uuid";
import { formatOrderNumber, formatIstDateTime, toIst, MONTH_ABBR, OrderSearchType } from "@/lib/services/orders/orderFilters";

const DOWNLOAD_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days
const DOWNLOAD_TOKEN_MAX_USES = 20;
/** Postgres int4 max — the ceiling for any value bound for an Int column (orderNumber here). */
const POSTGRES_INT4_MAX = 2147483647;

interface OrderListFilters {
  fromDate?: Date;
  toDate?: Date;
  status?: "PAID" | "FAILED";
  productId?: string;
  search?: { type: OrderSearchType; query: string };
}

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
   * Creates an order covering every productId in the cart. Prices are
   * snapshotted from the Product table right now — later edits to a
   * product's price never retroactively change a past sale.
   *
   * A cart totaling exactly ₹0 (a lone free item, or several) never
   * touches Razorpay at all — there is nothing to charge, so there is
   * nothing to wait on. It's created and finalized as PAID in one step,
   * same downstream behavior (tokens, receipt email) as a real payment
   * confirming. Any cart with a nonzero total — including a free item
   * mixed with a paid one — goes through the normal PENDING + Razorpay
   * flow unchanged; the free item simply contributes ₹0 to that sum,
   * which the existing reduce() already handles with no special-casing.
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
    const itemsData = products.map((p) => ({
      productId: p.id,
      titleSnapshot: p.title,
      priceInPaiseSnapshot: p.priceInPaise,
    }));

    if (amountInPaise === 0) {
      const order = await prisma.order.create({
        data: {
          storeId,
          buyerName,
          buyerEmail,
          buyerPhone,
          amountInPaise: 0,
          status: "PAID",
          // razorpayOrderId is a required, unique column with no Razorpay
          // order behind it here — synthesized so the column's NOT NULL/
          // unique constraints hold without a schema change or ever
          // calling the real API. "free_" makes it unmistakable in the
          // DB/logs; a real Razorpay order id is always "order_...".
          razorpayOrderId: `free_${uuid()}`,
          items: { create: itemsData },
        },
        include: { items: true },
      });

      await this.recordPolicyConsents(order.id, storeId);
      await this.finalizePaidOrder(order);
      return order;
    }

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
        items: { create: itemsData },
      },
      include: { items: true },
    });

    await this.recordPolicyConsents(order.id, storeId);
    return order;
  }

  /**
   * Writes one PolicyConsent row per policy type (TERMS/PRIVACY/
   * REFUND_POLICY) at the moment an order is created — consent is about
   * what the buyer agreed to when they clicked Pay, not whether the
   * payment later succeeded, so this runs for both the ₹0-instant-PAID
   * path and the normal PENDING-then-Razorpay path, unconditionally.
   * Uses the order's OWN storeId (never a default) and always the
   * CURRENT published version at this exact moment — every field other
   * than the FK/ids is a deliberate snapshot (see the PolicyConsent
   * model comment), so this consent record's legal meaning never changes
   * even if the policy is edited and republished five minutes later.
   * createCheckoutSchema's `policiesAccepted: z.literal(true)` is what
   * actually gates whether this method is ever reached — route handlers
   * never call createPendingOrder without that having already been true.
   */
  private async recordPolicyConsents(orderId: string, storeId: string) {
    const policyService = getPolicyService();

    for (const policyType of PolicyService.ALL_TYPES) {
      const published = await policyService.getCurrentPublished(storeId, policyType);
      if (!published || !published.version || !published.effectiveAt || !published.contentHash) {
        throw new Error(
          `Could not complete checkout — this store's ${policyType} policy is not published yet`
        );
      }

      await prisma.policyConsent.create({
        data: {
          orderId,
          storeId,
          policyVersionId: published.id,
          policyType,
          version: published.version,
          effectiveAt: published.effectiveAt,
          contentHash: published.contentHash,
        },
      });
    }
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
      await this.finalizePaidOrder(updated);
    }

    return updated;
  }

  /**
   * Everything that happens the moment an order becomes PAID, regardless
   * of how it got there — a verified Razorpay payment (markPaidByRazorpayOrderId)
   * or a ₹0 cart that skipped Razorpay entirely (createPendingOrder).
   * Issues one download token per item, sends the receipt email, and
   * records the delivery attempt — the exact same sequence either path
   * used to do inline before this was pulled out to keep them identical.
   */
  private async finalizePaidOrder(order: {
    id: string;
    buyerEmail: string;
    buyerName: string;
    orderNumber: number;
    createdAt: Date;
    items: { id: string; titleSnapshot: string }[];
  }) {
    const tokens: { title: string; token: string }[] = [];
    for (const item of order.items) {
      const dt = await this.issueDownloadToken(item.id);
      tokens.push({ title: item.titleSnapshot, token: dt.token });
    }
    const sent = await this.sendReceiptEmail(order.buyerEmail, order.buyerName, order.orderNumber, order.createdAt, tokens);
    await this.recordEmailDelivery(order.id, order.buyerEmail, sent, "CHECKOUT");
  }

  /**
   * Best-effort audit-log write, same spirit as sendReceiptEmail itself:
   * a logging failure (e.g. a transient DB hiccup) must never fail the
   * checkout/payment-confirmation flow that's already proven working in
   * production — swallow and log, don't rethrow.
   */
  private async recordEmailDelivery(
    orderId: string,
    sentToEmail: string,
    sent: boolean,
    triggeredBy: "CHECKOUT" | "ADMIN_RESEND"
  ) {
    try {
      await prisma.emailDelivery.create({
        data: { orderId, sentToEmail, status: sent ? "SENT" : "FAILED", triggeredBy },
      });
    } catch (err) {
      console.error("[order] recordEmailDelivery failed:", err);
    }
  }

  /**
   * Best-effort — a failed email must never fail the checkout itself,
   * since the buyer already has working download links on-screen from
   * the client-confirmation path. EmailService itself never throws for a
   * provider-reported failure (see ResendEmailService/BrevoEmailService)
   * for the same reason; the try/catch here only guards against something
   * more fundamental going wrong (e.g. a provider misconfigured badly
   * enough to throw before making the request). Returns whether the send
   * actually succeeded — markPaidByRazorpayOrderId ignores it (checkout
   * must never fail on this), but resendDownloadEmail needs it to record
   * an accurate EmailDelivery status.
   */
  private async sendReceiptEmail(
    to: string,
    buyerName: string,
    orderNumber: number,
    orderDate: Date,
    tokens: { title: string; token: string }[]
  ): Promise<boolean> {
    const formattedOrderNumber = formatOrderNumber(orderNumber);

    try {
      return await this.email.send({
        to,
        subject: `Order ${formattedOrderNumber} — your FrostEarth download links`,
        html: buildReceiptEmailHtml({ buyerName, orderNumber, orderDate, tokens }),
      });
    } catch (err) {
      console.error("[order] sendReceiptEmail failed:", err);
      return false;
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
   * Like getOrIssueDownloadTokens, but for an admin resend rather than
   * the buyer's own immediate post-checkout page — reuses a per-item
   * token only if it's still genuinely usable (same expiry + use-count
   * definition of "valid" that redeemDownloadToken enforces at redemption
   * time), not just "any token exists". An item whose only tokens are all
   * expired/exhausted gets a fresh one instead of handing out a link that
   * would fail the moment the recipient clicked it.
   */
  async getOrIssueValidDownloadTokens(order: { id: string; items: { id: string; titleSnapshot: string }[] }) {
    const existing = await this.getDownloadTokensForOrder(order.id);
    const now = new Date();

    const results: { title: string; token: string }[] = [];
    for (const item of order.items) {
      const valid = existing.find(
        (t) => t.orderItemId === item.id && t.expiresAt > now && t.usedCount < DOWNLOAD_TOKEN_MAX_USES
      );
      const token = valid ?? (await this.issueDownloadToken(item.id));
      results.push({ title: item.titleSnapshot, token: token.token });
    }
    return results;
  }

  /**
   * Admin-initiated resend of an order's download links to a possibly
   * different address than Order.buyerEmail — that field is deliberately
   * never touched here, it stays exactly as submitted at checkout (search/
   * exports/identification rely on it). Every attempt, success or
   * failure, is recorded in EmailDelivery so the dashboard has a full
   * audit trail instead of a creator wondering "did I already resend
   * this, and to which address?"
   */
  async resendDownloadEmail(storeId: string, orderId: string, targetEmail: string) {
    const order = await this.getForStore(storeId, orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "PAID") throw new Error("Order is not paid");

    const tokens = await this.getOrIssueValidDownloadTokens(order);
    const sent = await this.sendReceiptEmail(targetEmail, order.buyerName, order.orderNumber, order.createdAt, tokens);

    await prisma.emailDelivery.create({
      data: {
        orderId: order.id,
        sentToEmail: targetEmail,
        status: sent ? "SENT" : "FAILED",
        triggeredBy: "ADMIN_RESEND",
      },
    });

    if (!sent) throw new Error("Email could not be sent. Try again in a moment.");
    return { sentTo: targetEmail };
  }

  /** Full delivery history for one order's dashboard detail page — every admin resend attempt, newest first. */
  async getEmailDeliveriesForOrder(orderId: string) {
    return prisma.emailDelivery.findMany({
      where: { orderId },
      orderBy: { sentAt: "desc" },
    });
  }

  /**
   * A single order, scoped to a store — the buyer-facing order
   * confirmation page's only access check (the orderId itself, plus
   * belonging to this store, same trust model download tokens already
   * use; there's no buyer login to check against).
   */
  async getForStore(storeId: string, orderId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: true },
    });
  }

  /**
   * Creator-initiated lookup behind the dashboard's manual "Download
   * PDF" action — a support tool for handing a struggling buyer their
   * file directly (email/WhatsApp), not a buyer redemption. Scoped by
   * storeId exactly like getForStore (ownership check), but deliberately
   * does NOT touch DownloadToken at all: no expiry check, no usedCount
   * increment, no token minted. The buyer's own token/use-count budget
   * is completely unaffected by a creator doing this.
   */
  async getItemForAdminDownload(storeId: string, orderId: string, orderItemId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: { include: { product: true } } },
    });
    if (!order) throw new Error("Order not found");
    if (order.status !== "PAID") throw new Error("Order is not paid");

    const item = order.items.find((i) => i.id === orderItemId);
    if (!item) throw new Error("Item not found on this order");

    return {
      product: item.product,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        buyerPhone: order.buyerPhone,
      },
      // Same reasoning as redeemDownloadToken: the item's snapshotted
      // sale price, not the product's current listed price.
      priceInPaiseSnapshot: item.priceInPaiseSnapshot,
    };
  }

  /**
   * Reuses whatever download token already exists per item (minted once,
   * at payment-confirmation time in markPaidByRazorpayOrderId) instead of
   * minting a new one on every visit to the confirmation page — a page
   * refresh must not hand out additional redemptions on top of the
   * existing MAX_USES cap. Only mints a token if an item somehow has none.
   */
  async getOrIssueDownloadTokens(order: { id: string; items: { id: string; titleSnapshot: string }[] }) {
    const existing = await this.getDownloadTokensForOrder(order.id);
    const existingByItemId = new Map(existing.map((t) => [t.orderItemId, t]));

    const results: { title: string; token: string }[] = [];
    for (const item of order.items) {
      const found = existingByItemId.get(item.id);
      const token = found ?? (await this.issueDownloadToken(item.id));
      results.push({ title: item.titleSnapshot, token: token.token });
    }
    return results;
  }

  /**
   * `filters` is optional so every existing call site (dashboard overview
   * stats, and the CSV export) keeps working unchanged. Unbounded on
   * purpose — the overview needs every order for accurate aggregate
   * stats, and the CSV export must return every matching row regardless
   * of what page the creator is currently viewing on the Orders page, so
   * neither of them can go through the paginated method below.
   */
  async listForStore(storeId: string, filters: OrderListFilters = {}) {
    return prisma.order.findMany({
      where: buildOrderWhere(storeId, filters),
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * The Orders page's actual query — a real bounded fetch via Prisma's
   * skip/take, not an unbounded findMany() sliced in JS (that would still
   * pull every matching row from the DB on every request, solving
   * nothing at 1500+ orders and growing). The count() runs in the same
   * $transaction as the page fetch so both queries share one consistent
   * snapshot and go over the wire together.
   */
  async listForStorePaginated(
    storeId: string,
    filters: OrderListFilters,
    pagination: { page: number; pageSize: number }
  ) {
    const where = buildOrderWhere(storeId, filters);
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        // The dense table's Item column shows the CURRENT product's
        // subjectCode (not a snapshot — it's a lightweight admin label a
        // creator can add/edit on a product after orders already exist,
        // unlike titleSnapshot which is deliberately frozen at sale time).
        // Only that one scalar is pulled per item's product, not the
        // whole row.
        include: { items: { include: { product: { select: { subjectCode: true } } } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: pagination.pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };
  }

  /**
   * Resolves a download token to the product it unlocks plus the buyer
   * identity that watermarking needs — the caller (DownloadService) never
   * touches the client for any of this, only what a verified, paid order
   * record actually says. Enforces expiry + use-count + paid status.
   */
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

    const { product, order } = record.orderItem;
    return {
      product,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        buyerPhone: order.buyerPhone,
      },
      // The item's snapshotted sale price, not product.priceInPaise (the
      // product's CURRENT listed price, which can change after the sale)
      // — DownloadService uses this to decide whether this specific
      // download gets the visible watermark, and it has to reflect what
      // was actually paid for THIS order, not what the product costs now.
      priceInPaiseSnapshot: record.orderItem.priceInPaiseSnapshot,
    };
  }

  /**
   * The dashboard metrics row's four numbers for one date range. Called
   * twice by the page (current range, comparison range) to compute the
   * percentage-change indicators — count()/aggregate() here, never a full
   * row fetch, since none of the four numbers need the actual order rows.
   */
  async getDashboardStats(storeId: string, from: Date | undefined, to: Date) {
    const dateWhere: Prisma.OrderWhereInput = { createdAt: { ...(from ? { gte: from } : {}), lte: to } };

    const [paidCount, revenueAgg, failedCount] = await Promise.all([
      prisma.order.count({ where: { storeId, ...dateWhere, status: "PAID" } }),
      prisma.order.aggregate({
        where: { storeId, ...dateWhere, status: "PAID" },
        _sum: { amountInPaise: true },
      }),
      // FAILED + PENDING, same collapse as the Orders page badge and filters.
      prisma.order.count({ where: { storeId, ...dateWhere, status: { in: ["FAILED", "PENDING"] } } }),
    ]);

    const revenueInPaise = revenueAgg._sum.amountInPaise ?? 0;
    const attempted = paidCount + failedCount;
    const conversionRate = attempted > 0 ? (paidCount / attempted) * 100 : 0;

    return { revenueInPaise, paidCount, failedCount, conversionRate };
  }

  /**
   * One row per IST calendar day in [from, to] for the paid-vs-failed
   * line chart, densified so zero-order days still appear on the x-axis
   * instead of being skipped (skipping them would misrepresent gaps as
   * compressed time). The underlying query only selects createdAt/status
   * — no amounts, no relations — and is bounded by the same range every
   * other widget on the page uses. For "All time" (from=undefined) the
   * chart's start is the earliest ACTUAL order in this store rather than
   * an arbitrary epoch, so a young store never has to walk years of
   * empty days; the fetch itself is still genuinely unbounded in that one
   * specific case, which is inherent to what "All time" means, not a
   * missed bound — every other range has a real `gte`.
   */
  async getDailyOrderCounts(storeId: string, from: Date | undefined, to: Date) {
    const orders = await prisma.order.findMany({
      where: { storeId, createdAt: { ...(from ? { gte: from } : {}), lte: to } },
      select: { createdAt: true, status: true },
    });

    const byDay = new Map<string, { paid: number; failed: number }>();
    let earliest = to;
    for (const o of orders) {
      if (o.createdAt < earliest) earliest = o.createdAt;
      const key = dayKey(toIst(o.createdAt));
      const bucket = byDay.get(key) ?? { paid: 0, failed: 0 };
      if (o.status === "PAID") bucket.paid++;
      else bucket.failed++; // FAILED or PENDING, same collapse as elsewhere
      byDay.set(key, bucket);
    }

    const rangeStart = from ?? (orders.length > 0 ? earliest : to);
    const cursor = toIst(rangeStart);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = toIst(to);
    end.setUTCHours(0, 0, 0, 0);

    const series: { date: string; paid: number; failed: number }[] = [];
    while (cursor.getTime() <= end.getTime()) {
      const bucket = byDay.get(dayKey(cursor)) ?? { paid: 0, failed: 0 };
      series.push({ date: formatShortDay(cursor), paid: bucket.paid, failed: bucket.failed });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return series;
  }

  /**
   * Top products by revenue in [from, to], PAID orders only. Sums
   * OrderItem.priceInPaiseSnapshot (the price at time of sale, immune to
   * later product price/title changes) grouped by productId in
   * application code — a plain findMany with a lean select, not a Prisma
   * groupBy across the order relation, which would be more moving parts
   * than this actually needs at current scale.
   */
  async getTopProducts(storeId: string, from: Date | undefined, to: Date, limit = 5) {
    const items = await prisma.orderItem.findMany({
      where: {
        order: { storeId, status: "PAID", createdAt: { ...(from ? { gte: from } : {}), lte: to } },
      },
      select: { productId: true, titleSnapshot: true, priceInPaiseSnapshot: true },
    });

    const byProduct = new Map<string, { title: string; revenueInPaise: number }>();
    for (const item of items) {
      const existing = byProduct.get(item.productId) ?? { title: item.titleSnapshot, revenueInPaise: 0 };
      existing.revenueInPaise += item.priceInPaiseSnapshot;
      byProduct.set(item.productId, existing);
    }

    return Array.from(byProduct.entries())
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.revenueInPaise - a.revenueInPaise)
      .slice(0, limit);
  }

  /**
   * The latest few orders regardless of the dashboard's selected date
   * range — "what just happened," not scoped by the filter that governs
   * every other widget on the page.
   */
  async getRecentOrders(storeId: string, limit = 5) {
    return prisma.order.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        buyerName: true,
        amountInPaise: true,
        status: true,
        createdAt: true,
      },
    });
  }
}

/**
 * Shared by listForStore and listForStorePaginated so the two query paths
 * (unbounded export/stats vs. bounded page view) can never drift apart on
 * what "matches the current filters" means.
 */
function buildOrderWhere(storeId: string, filters: OrderListFilters): Prisma.OrderWhereInput {
  const { fromDate, toDate, status, productId, search } = filters;

  return {
    storeId,
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    // "FAILED" matches both FAILED and PENDING orders — the dashboard's
    // on-screen badge already collapses PENDING into "Failed" for display
    // (see StatusBadge in the orders page), so the filter has to match
    // what a creator actually sees, not the raw underlying status.
    ...(status === "PAID" ? { status: "PAID" as const } : {}),
    ...(status === "FAILED" ? { status: { in: ["FAILED", "PENDING"] as const } } : {}),
    ...(productId ? { items: { some: { productId } } } : {}),
    ...buildSearchWhere(search),
  };
}

function buildSearchWhere(search?: { type: OrderSearchType; query: string }): Prisma.OrderWhereInput {
  if (!search) return {};

  switch (search.type) {
    case "orderNumber": {
      // orderNumber is a real Postgres Int (see prisma/schema.prisma), so
      // this is an exact match, not a substring one — Prisma/Postgres
      // can't do "contains" on an integer column without a text cast,
      // and exact ID lookup is the normal expectation anyway (a creator
      // pastes/types the number off a receipt, e.g. "47" or "FE-000047").
      // Non-digit input (or none) must match nothing, not silently fall
      // through to "no filter" and return every order. Also must never
      // pass a value outside Postgres's int4 range (-2147483648..2147483647)
      // to Prisma — an out-of-range Int crashes the query with a raw DB
      // error instead of just matching nothing (confirmed bug: a 10-digit
      // mobile number pasted into this same field exceeds int4 max).
      const digitsOnly = search.query.replace(/\D/g, "");
      const parsed = digitsOnly ? parseInt(digitsOnly, 10) : NaN;
      const inRange = !Number.isNaN(parsed) && parsed >= 0 && parsed <= POSTGRES_INT4_MAX;
      return { orderNumber: inRange ? parsed : -1 };
    }
    case "email":
      return { buyerEmail: { contains: search.query, mode: "insensitive" as const } };
    case "phone":
      return { buyerPhone: { contains: search.query } };
    case "paymentRef":
      return { razorpayPaymentId: { contains: search.query } };
    case "buyerName":
      return { buyerName: { contains: search.query, mode: "insensitive" as const } };
    default:
      return {};
  }
}

export function getOrderService() {
  return new OrderService();
}

/** Groups an IST-shifted Date into its calendar day — same key regardless of time-of-day, so all of one IST day's orders land in one bucket. */
function dayKey(istDate: Date): string {
  return `${istDate.getUTCFullYear()}-${istDate.getUTCMonth()}-${istDate.getUTCDate()}`;
}

/** "05 Aug" — the line chart's x-axis label. Reuses MONTH_ABBR from orderFilters.ts rather than a second month-name list. */
function formatShortDay(istDate: Date): string {
  const dd = String(istDate.getUTCDate()).padStart(2, "0");
  return `${dd} ${MONTH_ABBR[istDate.getUTCMonth()]}`;
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
                  <a href="${appUrl}/download/${t.token}" style="display:inline-block; background-color:#2E5C8A; color:#ffffff; font-family:Arial, Helvetica, sans-serif; font-size:13px; font-weight:700; text-decoration:none; padding:10px 22px; border-radius:24px;">Download</a>
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
            <p style="margin:0 0 4px 0; font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#6B6B68;">These links expire in 3 days and can be used up to 10 times.</p>
            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#6B6B68;">For best results, open this link in Safari or Chrome rather than inside an app like Instagram or WhatsApp.</p>
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
