import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { resendDownloadEmailSchema } from "@/lib/validation/checkout";

/**
 * Creator-initiated resend of an order's download links to an address
 * that may differ from Order.buyerEmail (typo at checkout, buyer wants it
 * at a different inbox, etc.) — same session gate as every other admin
 * order route. Server-side email validation is required here, not just
 * a formality: the client form validates too, but this is the actual
 * trust boundary before an email gets sent and an EmailDelivery row
 * written.
 */
export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = resendDownloadEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await getOrderService().resendDownloadEmail(session.storeId, params.orderId, parsed.data.email);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not resend" }, { status: 400 });
  }
}
