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
      parsed.data.buyerPhone
    );
    return NextResponse.json({
      orderId: order.id,
      // The raw sequential orderNumber int is deliberately never sent
      // here — it isn't even read by the client (CartCheckout only uses
      // orderId/status/keyId/amountInPaise/razorpayOrderId), and sending
      // it would hand any buyer a live count of how many orders this
      // store has ever had. The order confirmation page displays the
      // obfuscated code (see lib/utils/orderCode.ts) itself, server-side.
      razorpayOrderId: order.razorpayOrderId,
      amountInPaise: order.amountInPaise,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      // "PAID" here means a ₹0 cart — createPendingOrder already skipped
      // Razorpay and finalized it. The client branches on this instead of
      // recomputing the cart total itself, so the server's authoritative
      // amount always decides, never the client's own (possibly stale)
      // number.
      status: order.status,
    });
  } catch (err: any) {
    console.error("[checkout] createPendingOrder failed:", JSON.stringify(err, null, 2));
    const detail = err?.error?.description || err?.message || "Could not create order";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
