import Link from "next/link";
import { getSession } from "@/lib/session";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { getProductService } from "@/lib/services/products/ProductService";
import {
  parseOrderFilters,
  formatIstDateTime,
  formatOrderNumber,
  ORDER_SEARCH_TYPES,
} from "@/lib/services/orders/orderFilters";
import AutoRefresh from "@/components/AutoRefresh";

const ORDERS_PAGE_SIZE = 50;

interface OrdersPageProps {
  searchParams: {
    fromDate?: string;
    toDate?: string;
    status?: string;
    productId?: string;
    searchType?: string;
    searchQuery?: string;
    page?: string;
  };
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await getSession();
  const storeId = session!.storeId;

  const filters = parseOrderFilters(searchParams);
  const hasFilters = Boolean(
    searchParams.fromDate ||
      searchParams.toDate ||
      searchParams.status ||
      searchParams.productId ||
      searchParams.searchQuery
  );

  const requestedPage = parseInt(searchParams.page || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [{ orders, total, totalPages }, products] = await Promise.all([
    getOrderService().listForStorePaginated(storeId, filters, { page, pageSize: ORDERS_PAGE_SIZE }),
    getProductService().listForStore(storeId),
  ]);

  // Filters + search only — deliberately NEVER includes `page`. The CSV
  // export always returns every matching row regardless of what page is
  // currently on screen, and reusing this same param set for Previous/
  // Next (just adding `page` on top) is what makes changing a filter
  // reset back to page 1: the filter form doesn't carry a page field, so
  // submitting it naturally lands on a URL with no `page` param at all.
  const filterParams = new URLSearchParams();
  if (searchParams.fromDate) filterParams.set("fromDate", searchParams.fromDate);
  if (searchParams.toDate) filterParams.set("toDate", searchParams.toDate);
  if (searchParams.status) filterParams.set("status", searchParams.status);
  if (searchParams.productId) filterParams.set("productId", searchParams.productId);
  if (searchParams.searchType) filterParams.set("searchType", searchParams.searchType);
  if (searchParams.searchQuery) filterParams.set("searchQuery", searchParams.searchQuery);

  const exportHref = `/api/orders/export${filterParams.toString() ? `?${filterParams.toString()}` : ""}`;

  function pageHref(targetPage: number) {
    const p = new URLSearchParams(filterParams);
    p.set("page", String(targetPage));
    return `/dashboard/orders?${p.toString()}`;
  }

  return (
    <div>
      <AutoRefresh />

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

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Search</label>
          <div className="flex rounded-full border border-fog overflow-hidden focus-within:ring-2 focus-within:ring-frost">
            <select
              name="searchType"
              defaultValue={searchParams.searchType || ORDER_SEARCH_TYPES[0].value}
              className="bg-fog/40 border-0 border-r border-fog px-3 py-2 text-sm text-ink focus:outline-none"
            >
              {ORDER_SEARCH_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="searchQuery"
              defaultValue={searchParams.searchQuery || ""}
              placeholder="Search…"
              className="flex-1 min-w-0 border-0 px-3 py-2 text-sm focus:outline-none"
            />
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
        <>
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

          {/* Pagination — Previous/Next preserve every current filter/search value; only `page` changes */}
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-slate">
              Page {page} of {totalPages} · {total} order{total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-3">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="text-sm rounded-full border border-fog px-4 py-2 text-ink hover:border-ink transition-colors"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="text-sm rounded-full border border-fog px-4 py-2 text-slate opacity-50 cursor-not-allowed">
                  ← Previous
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="text-sm rounded-full border border-fog px-4 py-2 text-ink hover:border-ink transition-colors"
                >
                  Next →
                </Link>
              ) : (
                <span className="text-sm rounded-full border border-fog px-4 py-2 text-slate opacity-50 cursor-not-allowed">
                  Next →
                </span>
              )}
            </div>
          </div>
        </>
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
