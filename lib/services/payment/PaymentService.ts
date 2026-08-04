export interface CreatePaymentOrderInput {
  amountInPaise: number;
  receipt: string; // our internal order id
  notes?: Record<string, string>;
}

export interface CreatePaymentOrderResult {
  providerOrderId: string;
}

export interface VerifyWebhookInput {
  rawBody: string;
  signatureHeader: string;
}

export interface WebhookEvent {
  providerOrderId: string;
  providerPaymentId: string;
  status: "captured" | "failed";
}

/**
 * Payment gateway abstraction. OrderService only knows this interface —
 * never the Razorpay SDK directly. Adding Stripe/PayU later means one
 * new class implementing this, plus one new webhook route.
 */
export interface PaymentService {
  createOrder(input: CreatePaymentOrderInput): Promise<CreatePaymentOrderResult>;
  verifyWebhookSignature(input: VerifyWebhookInput): boolean;
  parseWebhookEvent(rawBody: string): WebhookEvent;
  verifyCheckoutSignature(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean;
}
