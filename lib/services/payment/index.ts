import { PaymentService } from "./PaymentService";
import { RazorpayPaymentService } from "./RazorpayPaymentService";

/**
 * Factory — swap or add gateways here only. OrderService and API routes
 * never import RazorpayPaymentService directly.
 */
export function getPaymentService(): PaymentService {
  const provider = process.env.PAYMENT_PROVIDER || "razorpay";
  switch (provider) {
    case "razorpay":
      return new RazorpayPaymentService();
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: ${provider}`);
  }
}
