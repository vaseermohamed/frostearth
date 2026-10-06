import { beforeAll, describe, expect, it } from "vitest";
import { RazorpayPaymentService } from "@/lib/services/payment/RazorpayPaymentService";

const event = (name: string, entity: any = { id: "pay_1", order_id: "order_1" }) =>
  JSON.stringify({ event: name, payload: { payment: { entity } } });

describe("RazorpayPaymentService.parseWebhookEvent", () => {
  let svc: RazorpayPaymentService;
  beforeAll(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    svc = new RazorpayPaymentService();
  });

  it("maps payment.captured and payment.failed", () => {
    expect(svc.parseWebhookEvent(event("payment.captured")).status).toBe("captured");
    expect(svc.parseWebhookEvent(event("payment.failed")).status).toBe("failed");
  });

  it.each(["payment.authorized", "order.paid", "refund.processed"])("ignores %s", (name) => {
    expect(svc.parseWebhookEvent(event(name)).status).toBe("ignored");
  });

  it("ignores an event with no payment entity", () => {
    expect(svc.parseWebhookEvent(JSON.stringify({ event: "payment.captured", payload: {} })).status).toBe("ignored");
  });
});
