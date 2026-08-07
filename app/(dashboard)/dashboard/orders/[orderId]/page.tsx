import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { formatOrderNumber, formatIstDateTime } from "@/lib/services/orders/orderFilters";
import OrderStatusBadge from "@/components/dashboard/OrderStatusBadge";

/**
 * Creator-only, full-detail view of a single order — separate from the
 * buyer-facing app/c/[slug]/order/[orderId]/page.tsx (no auth, download
 * links only). This one requires a dashboard session (same pattern as
 * every other /dashboard/* page) and shows everything: payment
 * reference in the open (not collapsed, unlike the old orders-list
 * cards), full item titles (not subject codes — this is the "see
 * everything" view, subject codes are a list-scanning shorthand only).
 * Reuses OrderService.getForStore — the same store-scoped lookup the
 * buyer-facing page already uses — rather than adding a near-duplicate
 * method.
 */
export default async function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const session = await getSession();
  const order = await getOrderService().getForStore(session!.storeId, params.orderId);
  if (!order) notFound();

  return (
    <div>
      <Link
        href="/dashboard/orders"
        className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4"
      >
        ← Back to orders
      </Link>

      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-semibold">
          Order <span className="font-mono">#{formatOrderNumber(order.orderNumber)}</span>
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="bg-white rounded-2xl border border-fog p-6 mb-6 space-y-4">
        <div>
          <p className="text-sm text-slate mb-1">Date</p>
          <p className="text-ink">{formatIstDateTime(order.createdAt)}</p>
        </div>

        <div>
          <p className="text-sm text-slate mb-1">Buyer</p>
          <p className="text-ink font-medium break-words">{order.buyerName}</p>
          <p className="text-sm text-slate break-words">{order.buyerEmail}</p>
          {order.buyerPhone && <p className="text-sm text-slate">{order.buyerPhone}</p>}
        </div>

        {order.razorpayPaymentId && (
          <div>
            <p className="text-sm text-slate mb-1">Payment reference</p>
            <p className="font-mono text-sm text-ink break-words">{order.razorpayPaymentId}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-fog divide-y divide-fog mb-6">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-4">
            <span className="text-sm text-ink break-words">{item.titleSnapshot}</span>
            <span className="font-mono text-sm text-ink shrink-0">
              ₹{(item.priceInPaiseSnapshot / 100).toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-fog p-5 flex items-center justify-between">
        <span className="font-medium text-ink">Total</span>
        <span className="font-mono font-bold text-lg text-ink">
          ₹{(order.amountInPaise / 100).toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}
