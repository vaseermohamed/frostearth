import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory stand-in for the two Prisma models the payment and download
 * paths touch. updateMany applies its whole where-clause and the write
 * in one synchronous step, the same atomicity Postgres gives a single
 * conditional UPDATE — which is exactly the guarantee the code relies on.
 */
const state = vi.hoisted(() => ({
  orders: new Map<string, any>(),
  tokens: new Map<string, any>(),
  emails: [] as any[],
}));

const db = vi.hoisted(() => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const matchesOrder = (o: any, where: any) =>
    o.id === where.id && (!where.status?.not || o.status !== where.status.not);
  return {
    order: {
      findUnique: vi.fn(async ({ where }: any) => {
        await tick();
        const o = [...state.orders.values()].find((x) => x.razorpayOrderId === where.razorpayOrderId);
        return o ? structuredClone(o) : null;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => structuredClone(state.orders.get(where.id))),
      updateMany: vi.fn(async ({ where, data }: any) => {
        await tick();
        const o = state.orders.get(where.id);
        if (!o || !matchesOrder(o, where)) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      }),
    },
    downloadToken: {
      create: vi.fn(async ({ data }: any) => {
        const t = { id: `t${state.tokens.size + 1}`, usedCount: 0, ...data };
        state.tokens.set(t.id, t);
        return t;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const t = state.tokens.get(where.id);
        if (!t || t.usedCount >= where.usedCount.lt || t.expiresAt <= where.expiresAt.gt) return { count: 0 };
        t.usedCount += data.usedCount.increment;
        return { count: 1 };
      }),
    },
    emailDelivery: { create: vi.fn(async () => ({})) },
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/services/email", () => ({
  getEmailService: () => ({ send: vi.fn(async (msg: any) => (state.emails.push(msg), true)) }),
}));
vi.mock("@/lib/services/payment", () => ({
  getPaymentService: () => ({
    verifyCheckoutSignature: () => true,
    verifyWebhookSignature: () => true,
    parseWebhookEvent: (raw: string) => JSON.parse(raw),
  }),
}));

import { OrderService } from "@/lib/services/orders/OrderService";

function seedOrder(status = "PENDING") {
  state.orders.set("o1", {
    id: "o1",
    razorpayOrderId: "order_1",
    status,
    buyerEmail: "buyer@example.com",
    buyerName: "Buyer",
    orderNumber: 1,
    createdAt: new Date(),
    items: [{ id: "i1", titleSnapshot: "Notes" }],
  });
}

describe("OrderService payment confirmation", () => {
  beforeEach(() => {
    state.orders.clear();
    state.tokens.clear();
    state.emails.length = 0;
    seedOrder();
  });

  it("finalizes once when the checkout callback and webhook arrive together", async () => {
    const svc = new OrderService();
    await Promise.all([
      svc.confirmClientCheckout({
        orderId: "o1",
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "sig",
      }),
      svc.confirmWebhookPayment(
        JSON.stringify({ providerOrderId: "order_1", providerPaymentId: "pay_1", status: "captured" }),
        "sig"
      ),
    ]);
    expect(state.orders.get("o1").status).toBe("PAID");
    expect(state.tokens.size).toBe(1);
    expect(state.emails).toHaveLength(1);
  });

  it("never downgrades a paid order on a late failure event", async () => {
    state.orders.get("o1").status = "PAID";
    await new OrderService().confirmWebhookPayment(
      JSON.stringify({ providerOrderId: "order_1", providerPaymentId: "pay_2", status: "failed" }),
      "sig"
    );
    expect(state.orders.get("o1").status).toBe("PAID");
    expect(state.emails).toHaveLength(0);
  });
});

describe("OrderService webhook filtering", () => {
  beforeEach(() => {
    state.orders.clear();
    state.emails.length = 0;
    seedOrder();
  });

  it("leaves the order alone for an ignored event type", async () => {
    const result = await new OrderService().confirmWebhookPayment(
      JSON.stringify({ providerOrderId: "order_1", providerPaymentId: "pay_1", status: "ignored" }),
      "sig"
    );
    expect(result).toBeNull();
    expect(state.orders.get("o1").status).toBe("PENDING");
  });

  it("acknowledges events for orders this app never created", async () => {
    const result = await new OrderService().confirmWebhookPayment(
      JSON.stringify({ providerOrderId: "order_other", providerPaymentId: "pay_9", status: "captured" }),
      "sig"
    );
    expect(result).toBeNull();
  });
});

describe("OrderService.consumeDownloadToken", () => {
  beforeEach(() => state.tokens.clear());

  it("stops at the use limit even under simultaneous downloads", async () => {
    const svc = new OrderService();
    const token = await svc.issueDownloadToken("i1");
    token.usedCount = 19;
    const results = await Promise.allSettled([svc.consumeDownloadToken(token.id), svc.consumeDownloadToken(token.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(state.tokens.get(token.id).usedCount).toBe(20);
  });

  it("rejects an expired token", async () => {
    const svc = new OrderService();
    const token = await svc.issueDownloadToken("i1");
    token.expiresAt = new Date(Date.now() - 1000);
    await expect(svc.consumeDownloadToken(token.id)).rejects.toThrow(/exhausted/);
  });
});
