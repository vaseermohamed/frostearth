import Razorpay from "razorpay";
import crypto from "crypto";
import {
  PaymentService,
  CreatePaymentOrderInput,
  CreatePaymentOrderResult,
  VerifyWebhookInput,
  WebhookEvent,
} from "./PaymentService";

export class RazorpayPaymentService implements PaymentService {
  private client: Razorpay;

  constructor() {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error("Razorpay credentials are not configured");
    }
    this.client = new Razorpay({ key_id, key_secret });
  }

  async createOrder(input: CreatePaymentOrderInput): Promise<CreatePaymentOrderResult> {
    const order = await this.client.orders.create({
      amount: input.amountInPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    });
    return { providerOrderId: order.id };
  }

  /**
   * Verifies the X-Razorpay-Signature header on incoming webhooks using
   * the webhook secret configured in the Razorpay dashboard. This is the
   * ONLY source of truth for "did this payment actually succeed" — the
   * client-side checkout callback is never trusted on its own.
   */
  verifyWebhookSignature({ rawBody, signatureHeader }: VerifyWebhookInput): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return timingSafeEqual(expected, signatureHeader);
  }

  parseWebhookEvent(rawBody: string): WebhookEvent {
    const payload = JSON.parse(rawBody);
    const entity = payload.payload?.payment?.entity;
    const status = payload.event === "payment.captured" ? "captured" : "failed";
    return {
      providerOrderId: entity?.order_id,
      providerPaymentId: entity?.id,
      status,
    };
  }

  /**
   * Belt-and-braces check of the signature Razorpay returns to the
   * browser after checkout, BEFORE we optimistically show a success
   * screen. The webhook is still what actually marks the order PAID.
   */
  verifyCheckoutSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  }: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return timingSafeEqual(expected, razorpaySignature);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
