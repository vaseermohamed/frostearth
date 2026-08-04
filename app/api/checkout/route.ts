import { NextRequest, NextResponse } from "next/server";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { createCheckoutSchema } from "@/lib/validation/checkout";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const order = await getOrderService().createPendingOrder(
      parsed.data.productIds,
      parsed.data.buyerName,
      parsed.data.buyerEmail,
      parsed.data.buyerPhone || undefined
    );
    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpayOrderId: order.razorpayOrderId,
      amountInPaise: order.amountInPaise,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error("[checkout] createPendingOrder failed:", JSON.stringify(err, null, 2));
    const detail = err?.error?.description || err?.message || "Could not create order";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
