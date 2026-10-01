import { z } from "zod";

export const createCheckoutSchema = z.object({
  // Upper bound is a technical safety cap, not a real catalog-size limit —
  // a single-creator PDF-notes store is never going to have a legitimate
  // 50-item cart, but an unbounded array is an easy DoS lever (a huge `IN`
  // clause) with no upside.
  productIds: z.array(z.string().min(1)).min(1, "Cart is empty").max(50, "Too many items in cart"),
  buyerName: z.string().min(1, "Name is required").max(200),
  buyerEmail: z.string().email().max(254),
  // Mandatory at the application layer only — Order.buyerPhone stays a
  // nullable DB column (see prisma/schema.prisma) because historical
  // orders placed before this requirement have no phone on record, and
  // that data must keep working, not get force-migrated. Zod is what
  // actually enforces "required" for every NEW checkout from here on.
  buyerPhone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  // DPDP-driven: the checkbox on the cart page is unchecked by default, so
  // this must be an explicit `true`, never an absent field defaulting to
  // "accepted" — z.literal rejects false/missing/anything else as a 400,
  // which is the actual server-side trust boundary (the client's disabled
  // Pay button is only a UX nicety on top of this).
  policiesAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms, Privacy Policy, and Refund Policy to continue" }),
  }),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export const verifyCheckoutSchema = z.object({
  orderId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export type VerifyCheckoutInput = z.infer<typeof verifyCheckoutSchema>;

export const resendDownloadEmailSchema = z.object({
  email: z.string().email().max(254),
});
export type ResendDownloadEmailInput = z.infer<typeof resendDownloadEmailSchema>;
