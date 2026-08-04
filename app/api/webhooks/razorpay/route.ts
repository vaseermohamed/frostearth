import { NextRequest, NextResponse } from "next/server";
import { getOrderService } from "@/lib/services/orders/OrderService";

/**
 * Razorpay requires the RAW request body for signature verification, so
 * this route reads text() rather than json() — parsing to JSON first
 * and re-serializing would break the HMAC check on whitespace/key-order
 * differences.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    await getOrderService().confirmWebhookPayment(rawBody, signature);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Respond 400, not 500 — Razorpay retries on non-2xx, and a bad
    // signature should not be retried indefinitely as a "server error".
    return NextResponse.json({ error: err.message || "Webhook processing failed" }, { status: 400 });
  }
}
