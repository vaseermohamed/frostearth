import { z } from "zod";

export const createCheckoutSchema = z.object({
  // Upper bound is a technical safety cap, not a real catalog-size limit —
  // a single-creator PDF-notes store is never going to have a legitimate
  // 50-item cart, but an unbounded array is an easy DoS lever (a huge `IN`
  // clause) with no upside.
  productIds: z.array(z.string().min(1)).min(1, "Cart is empty").max(50, "Too many items in cart"),
  buyerName: z.string().min(1, "Name is required").max(200),
  buyerEmail: z.string().email().max(254),
  buyerPhone: z
    .string()
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits")
    .optional()
    .or(z.literal("")),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export const verifyCheckoutSchema = z.object({
  orderId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export type VerifyCheckoutInput = z.infer<typeof verifyCheckoutSchema>;
