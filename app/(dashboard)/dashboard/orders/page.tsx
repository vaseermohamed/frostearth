import Link from "next/link";
import { getSession } from "@/lib/session";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { getProductService } from "@/lib/services/products/ProductService";
import {
  parseOrderFilters,
  formatCompactIstDateTime,
  formatOrderNumber,
  ORDER_SEARCH_TYPES,
} from "@/lib/services/orders/orderFilters";

// Same 7-column template used by the header row and every data row —
// defined once so the two can never drift out of alignment.
const GRID_COLS = "grid grid-cols-[100px_110px_1fr_110px_150px_100px_70px] gap-3 items-center";
const FAILED_RED = "#B91C1C"; // Tailwind's red-700 — the exact hex the old card StatusBadge used for FAILED

interface OrderRowItem {
  titleSnapshot: string;
  product: { subjectCode: string | null } | null;
}

/**
 * The order's single product's subjectCode if set, else the title as a
 * fallback — but only ever for a single-item order. Multi-item orders
 * never list multiple titles/codes inline (that's what the detail page
 * is for), just a count.
 */
function itemColumnLabel(items: OrderRowItem[]): string {
  if (items.length === 0) return "—";
  if (items.length > 1) return `${items.length} items`;
  const code = items[0].product?.subjectCode?.trim();
  return code || items[0].titleSnapshot;
}
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
          {/*
            Dense single-line-per-order table — replaces the old stacked
            cards (~200-280px each), which made scanning/scrolling
            impractical at 1,600+ orders. CSS grid rows rather than a
            literal <table> so each row can be a real, keyboard-navigable,
            right-click-openable <Link> (an <a> can't legally wrap a <tr>).
          */}
          <div className="bg-white rounded-2xl border border-fog divide-y divide-fog overflow-hidden">
            <div className={`${GRID_COLS} px-4 py-2.5`}>
              <span className="text-[11px] uppercase tracking-wide text-slate">Order</span>
              <span className="text-[11px] uppercase tracking-wide text-slate">Date</span>
              <span className="text-[11px] uppercase tracking-wide text-slate">Buyer</span>
              <span className="text-[11px] uppercase tracking-wide text-slate">Contact</span>
              <span className="text-[11px] uppercase tracking-wide text-slate">Item</span>
              <span className="text-[11px] uppercase tracking-wide text-slate text-right">Amount</span>
              <span className="text-[11px] uppercase tracking-wide text-slate text-right">Status</span>
            </div>

            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/dashboard/orders/${o.id}`}
                className={`${GRID_COLS} px-4 h-10 text-xs hover:bg-paper transition-colors`}
              >
                <span className="font-mono text-ink truncate">{formatOrderNumber(o.orderNumber)}</span>
                <span className="text-slate truncate">{formatCompactIstDateTime(o.createdAt)}</span>
                <span className="text-ink truncate" title={o.buyerName}>
                  {o.buyerName}
                </span>
                <span className="text-slate truncate">{o.buyerPhone || "—"}</span>
                <span className="text-ink truncate">{itemColumnLabel(o.items)}</span>
                <span className="font-mono text-ink text-right truncate">
                  ₹{(o.amountInPaise / 100).toLocaleString("en-IN")}
                </span>
                <span
                  className="text-right font-medium truncate"
                  style={{ color: o.status === "PAID" ? "#2E5C8A" : FAILED_RED }}
                >
                  {o.status === "PAID" ? "Paid" : "Failed"}
                </span>
              </Link>
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
