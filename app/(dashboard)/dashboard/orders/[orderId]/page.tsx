import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { getPolicyService } from "@/lib/services/policies/PolicyService";
import { formatOrderNumber, formatIstDateTime } from "@/lib/services/orders/orderFilters";
import OrderStatusBadge from "@/components/dashboard/OrderStatusBadge";
import ResendEmailForm from "@/components/dashboard/ResendEmailForm";

const POLICY_LABELS: Record<string, string> = {
  TERMS: "Terms of Service",
  PRIVACY: "Privacy Policy",
  REFUND_POLICY: "Refund Policy",
};

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

  const deliveries = order.status === "PAID" ? await getOrderService().getEmailDeliveriesForOrder(order.id) : [];
  const consents = await getPolicyService().getConsentsForOrder(order.id);

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
          <div key={item.id} className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink break-words">{item.titleSnapshot}</span>
              <span className="font-mono text-sm text-ink shrink-0">
                ₹{(item.priceInPaiseSnapshot / 100).toLocaleString("en-IN")}
              </span>
            </div>
            {order.status === "PAID" && (
              <div className="mt-2 flex justify-end">
                <a
                  href={`/api/admin/orders/${order.id}/download-item/${item.id}`}
                  className="inline-flex items-center gap-1.5 text-xs rounded-full border border-fog px-3 py-1.5 text-ink hover:border-ink transition-colors"
                >
                  <DownloadIcon />
                  Download PDF
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-fog p-5 flex items-center justify-between mb-6">
        <span className="font-medium text-ink">Total</span>
        <span className="font-mono font-bold text-lg text-ink">
          ₹{(order.amountInPaise / 100).toLocaleString("en-IN")}
        </span>
      </div>

      {consents.length > 0 && (
        <div className="bg-white rounded-2xl border border-fog p-5 mb-6">
          <p className="text-sm font-medium text-ink mb-3">Legal policy consent</p>
          <div className="divide-y divide-fog">
            {consents.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-ink">{POLICY_LABELS[c.policyType] ?? c.policyType}</span>
                <span className="text-xs text-slate text-right">
                  v{c.version} · effective {formatIstDateTime(c.effectiveAt)} ·{" "}
                  <span className="font-mono">{c.contentHash.slice(0, 12)}…</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {order.status === "PAID" && (
        <div className="bg-white rounded-2xl border border-fog p-6">
          <h2 className="font-medium text-ink mb-1">Resend download links</h2>
          <p className="text-sm text-slate mb-4">
            Buyer's own email stays <span className="font-medium text-ink">{order.buyerEmail}</span> — this only
            sends an extra copy somewhere else (e.g. if their email was mistyped at checkout).
          </p>
          <ResendEmailForm orderId={order.id} />

          {deliveries.length > 0 && (
            <div className="mt-5 pt-4 border-t border-fog">
              <p className="text-xs font-medium text-slate mb-2">Delivery history</p>
              <div className="divide-y divide-fog">
                {deliveries.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-ink break-words">{d.sentToEmail}</p>
                      <p className="text-xs text-slate">{formatIstDateTime(d.sentAt)}</p>
                    </div>
                    <span
                      className={`text-xs font-medium shrink-0 rounded-full px-2 py-0.5 ${
                        d.status === "SENT" ? "bg-frost/10 text-frost" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {d.status === "SENT" ? "Sent" : "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
