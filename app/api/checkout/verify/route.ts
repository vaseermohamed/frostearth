import { NextRequest, NextResponse } from "next/server";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { verifyCheckoutSchema } from "@/lib/validation/checkout";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = verifyCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const order = await getOrderService().confirmClientCheckout({
      orderId: parsed.data.orderId,
      razorpayOrderId: parsed.data.razorpay_order_id,
      razorpayPaymentId: parsed.data.razorpay_payment_id,
      razorpaySignature: parsed.data.razorpay_signature,
    });

    // Titles only, never a token value — delivery is email-only by
    // design, so the token must never reach the browser, not even in a
    // JSON field the UI happens not to render. CartCheckout only needs
    // `downloads?.length` to confirm the order actually has items; by the
    // time confirmClientCheckout returns, OrderService.finalizePaidOrder
    // has already issued one token per item (or thrown), so there's no
    // need for a second query here just to prove that happened.
    return NextResponse.json({
      status: order.status,
      orderNumber: order.orderNumber,
      downloads: order.items.map((item) => ({ title: item.titleSnapshot })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Verification failed" }, { status: 400 });
  }
}
