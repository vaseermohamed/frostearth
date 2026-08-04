import { NextRequest, NextResponse } from "next/server";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { verifyCheckoutSchema } from "@/lib/validation/checkout";
import { prisma } from "@/lib/db/prisma";

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

    const latestTokens = await prisma.downloadToken.findMany({
      where: { orderItem: { orderId: order.id } },
      include: { orderItem: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      status: order.status,
      orderNumber: order.orderNumber,
      downloads: latestTokens.map((t) => ({
        title: t.orderItem.titleSnapshot,
        token: t.token,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Verification failed" }, { status: 400 });
  }
}
