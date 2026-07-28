import { z } from "zod";

export const createCheckoutSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, "Cart is empty"),
  buyerEmail: z.string().email(),
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
