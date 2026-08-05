import Link from "next/link";
import { getSession } from "@/lib/session";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { getProductService } from "@/lib/services/products/ProductService";
import { parseOrderFilters, formatIstDateTime, formatOrderNumber } from "@/lib/services/orders/orderFilters";

interface OrdersPageProps {
  searchParams: {
    fromDate?: string;
    toDate?: string;
    status?: string;
    productId?: string;
  };
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await getSession();
  const storeId = session!.storeId;

  const filters = parseOrderFilters(searchParams);
  const hasFilters = Boolean(searchParams.fromDate || searchParams.toDate || searchParams.status || searchParams.productId);

  const [orders, products] = await Promise.all([
    getOrderService().listForStore(storeId, filters),
    getProductService().listForStore(storeId),
  ]);

  const exportParams = new URLSearchParams();
  if (searchParams.fromDate) exportParams.set("fromDate", searchParams.fromDate);
  if (searchParams.toDate) exportParams.set("toDate", searchParams.toDate);
  if (searchParams.status) exportParams.set("status", searchParams.status);
  if (searchParams.productId) exportParams.set("productId", searchParams.productId);
  const exportHref = `/api/orders/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <a
          href={exportHref}
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-4 py-2"
        >
          Download CSV
        </a>
      </div>

      <form method="GET" className="bg-white rounded-2xl border border-fog p-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">From</label>
            <input
              type="date"
              name="fromDate"
              defaultValue={searchParams.fromDate || ""}
              className="w-full rounded-md border border-fog px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To</label>
            <input
              type="date"
              name="toDate"
              defaultValue={searchParams.toDate || ""}
              className="w-full rounded-md border border-fog px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              name="status"
              defaultValue={searchParams.status || ""}
              className="w-full rounded-md border border-fog px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="PAID">Paid</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Product</label>
            <select
              name="productId"
              defaultValue={searchParams.productId || ""}
              className="w-full rounded-md border border-fog px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <button
            type="submit"
            className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-4 py-2"
          >
            Apply filters
          </button>
          {hasFilters && (
            <Link href="/dashboard/orders" className="text-sm text-slate hover:text-ink transition-colors">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      {orders.length === 0 ? (
        <p className="text-slate">{hasFilters ? "No orders match these filters." : "No orders yet."}</p>
      ) : (
        <div className="bg-white rounded-2xl border border-fog divide-y divide-fog">
          {orders.map((o) => (
            <div key={o.id} className="px-5 py-4">
              {/* Order # + date/time (left) — status + amount (right) */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 break-words">
                  <p className="font-mono text-sm font-medium text-ink">#{formatOrderNumber(o.orderNumber)}</p>
                  <p className="text-xs text-slate mt-0.5">{formatIstDateTime(o.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={o.status} />
                  <p className="font-mono text-lg font-bold text-ink mt-1.5">
                    ₹{(o.amountInPaise / 100).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Buyer — name is the primary line, email/phone read as one quieter contact-info unit */}
              <div className="mt-3 min-w-0 break-words">
                <p className="font-medium text-ink">{o.buyerName}</p>
                <p className="text-xs text-slate mt-0.5">
                  {o.buyerEmail}
                  {o.buyerPhone ? ` · ${o.buyerPhone}` : ""}
                </p>
              </div>

              {/* Payment reference — reconciliation detail, not glance-worthy, so it's collapsed */}
              {o.razorpayPaymentId && (
                <details className="mt-2">
                  <summary className="text-xs text-slate hover:text-ink transition-colors cursor-pointer select-none">
                    Payment reference
                  </summary>
                  <p className="text-xs text-slate font-mono break-words mt-1">{o.razorpayPaymentId}</p>
                </details>
              )}

              {/* Items */}
              <div className="mt-3 pt-3 border-t border-fog space-y-1.5">
                {o.items.map((item) => (
                  <div key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate break-words">{item.titleSnapshot}</span>
                    <span className="font-mono text-slate shrink-0">
                      ₹{(item.priceInPaiseSnapshot / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// PENDING orders (checkout started, payment never confirmed — abandoned
// carts, closed tabs, etc.) are shown as "Failed" here for simplicity,
// since from the creator's point of view both mean "no money received."
// The underlying PENDING status is still kept in the database for later
// analytics; this is a display-only simplification. The "Failed" filter
// above and the CSV export apply the same collapse (see orderFilters.ts).
function StatusBadge({ status }: { status: string }) {
  const isPaid = status === "PAID";
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        isPaid ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"
      }`}
    >
      {isPaid ? "PAID" : "FAILED"}
    </span>
  );
}
