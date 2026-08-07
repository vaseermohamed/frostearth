import Link from "next/link";
import { getSession } from "@/lib/session";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { formatOrderNumber } from "@/lib/services/orders/orderFilters";
import { resolveDashboardDateRange, getComparisonRange, percentChange, DATE_RANGE_PRESETS } from "@/lib/services/orders/dateRanges";
import AutoRefresh from "@/components/AutoRefresh";
import OrdersLineChart from "@/components/dashboard/OrdersLineChart";

const FAILED_RED = "#B91C1C"; // same hex as the Orders page's FAILED StatusBadge (text-red-700)

interface DashboardPageProps {
  searchParams: { range?: string; fromDate?: string; toDate?: string };
}

export default async function DashboardOverviewPage({ searchParams }: DashboardPageProps) {
  const session = await getSession();
  const storeId = session!.storeId;

  // The single date-range source for the whole page — every widget below
  // reads from `range`, none of them resolve their own.
  const range = resolveDashboardDateRange(searchParams);
  const comparisonRange = getComparisonRange(range);

  const orderService = getOrderService();

  const [stats, comparisonStats, dailyCounts, topProducts, recentOrders] = await Promise.all([
    orderService.getDashboardStats(storeId, range.from, range.to),
    comparisonRange ? orderService.getDashboardStats(storeId, comparisonRange.from, comparisonRange.to) : null,
    orderService.getDailyOrderCounts(storeId, range.from, range.to),
    orderService.getTopProducts(storeId, range.from, range.to),
    orderService.getRecentOrders(storeId, 5),
  ]);

  const revenueDelta = comparisonStats ? percentChange(stats.revenueInPaise, comparisonStats.revenueInPaise) : null;
  const paidDelta = comparisonStats ? percentChange(stats.paidCount, comparisonStats.paidCount) : null;
  const failedDelta = comparisonStats ? percentChange(stats.failedCount, comparisonStats.failedCount) : null;
  const conversionDelta = comparisonStats ? percentChange(stats.conversionRate, comparisonStats.conversionRate) : null;

  const maxProductRevenue = topProducts.length > 0 ? topProducts[0].revenueInPaise : 0;

  return (
    <div>
      <AutoRefresh />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">Overview</h1>
      </div>

      <DateRangeControl searchParams={searchParams} activePreset={range.preset} />

      {/* Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
        <MetricCard label="Revenue" value={`₹${(stats.revenueInPaise / 100).toLocaleString("en-IN")}`} delta={revenueDelta} />
        <MetricCard label="Paid orders" value={stats.paidCount} delta={paidDelta} />
        <MetricCard label="Failed orders" value={stats.failedCount} delta={failedDelta} invertColor />
        <MetricCard label="Conversion rate" value={`${stats.conversionRate.toFixed(1)}%`} delta={conversionDelta} />
      </div>

      {/* Line chart + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-8">
        <div className="bg-white rounded-sm border border-fog p-5">
          <h2 className="font-medium text-ink mb-4">Paid vs. failed</h2>
          <OrdersLineChart data={dailyCounts} />
        </div>
        <div className="bg-white rounded-sm border border-fog p-5">
          <h2 className="font-medium text-ink mb-4">Order status</h2>
          <StatusDonut paid={stats.paidCount} failed={stats.failedCount} />
        </div>
      </div>

      {/* Top products + recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-sm border border-fog p-5">
          <h2 className="font-medium text-ink mb-4">Top products</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate">No paid orders in this range yet.</p>
          ) : (
            <div className="space-y-4">
              {topProducts.map((p) => (
                <TopProductBar key={p.productId} title={p.title} revenueInPaise={p.revenueInPaise} maxRevenueInPaise={maxProductRevenue} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-sm border border-fog p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-ink">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-sm text-slate hover:text-ink transition-colors">
              View all →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-slate">No orders yet.</p>
          ) : (
            <div>
              {recentOrders.map((o) => (
                <RecentOrderRow key={o.id} order={o} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DateRangeControl({
  searchParams,
  activePreset,
}: {
  searchParams: { range?: string; fromDate?: string; toDate?: string };
  activePreset: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DATE_RANGE_PRESETS.map((p) => {
        const isActive = activePreset === p.value;
        return (
          <Link
            key={p.value}
            href={`/dashboard?range=${p.value}`}
            className={`text-sm rounded-full px-4 py-2 transition-colors ${
              isActive ? "bg-ink text-paper" : "border border-fog text-ink hover:border-ink"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
      <form method="GET" className="flex items-center gap-2">
        <input
          type="date"
          name="fromDate"
          defaultValue={searchParams.fromDate || ""}
          className="rounded-md border border-fog px-3 py-2 text-sm"
        />
        <span className="text-slate text-sm">to</span>
        <input
          type="date"
          name="toDate"
          defaultValue={searchParams.toDate || ""}
          className="rounded-md border border-fog px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-4 py-2"
        >
          Go
        </button>
      </form>
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  invertColor,
}: {
  label: string;
  value: string | number;
  delta: number | null;
  /** For "Failed orders": an increase (positive delta) is bad, a decrease is good — the opposite of every other card. */
  invertColor?: boolean;
}) {
  const isUp = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;
  const isGood = invertColor ? isDown : isUp;
  const isBad = invertColor ? isUp : isDown;

  return (
    <div className="bg-white rounded-sm border border-fog p-5">
      <p className="text-sm text-slate">{label}</p>
      <p className="font-mono text-2xl text-ink mt-1">{value}</p>
      {delta !== null && (
        <p
          className="text-xs font-mono mt-2"
          style={{ color: isGood ? "#2E5C8A" : isBad ? FAILED_RED : "#6B6B68" }}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta).toFixed(1)}%
        </p>
      )}
    </div>
  );
}

function StatusDonut({ paid, failed }: { paid: number; failed: number }) {
  const total = paid + failed;
  const paidPct = total > 0 ? (paid / total) * 100 : 0;
  const failedPct = 100 - paidPct;
  const gradient =
    total > 0 ? `conic-gradient(#2E5C8A 0% ${paidPct}%, ${FAILED_RED} ${paidPct}% 100%)` : "conic-gradient(#E8E8E4 0% 100%)";

  return (
    <div>
      <div className="relative w-36 h-36 mx-auto">
        <div className="w-full h-full rounded-full" style={{ background: gradient }} />
        <div className="absolute inset-3 rounded-full bg-white flex flex-col items-center justify-center">
          <p className="font-mono text-xl font-bold text-ink">{total}</p>
          <p className="text-xs text-slate">orders</p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#2E5C8A" }} />
          <span className="text-slate">Paid {paidPct.toFixed(0)}%</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FAILED_RED }} />
          <span className="text-slate">Failed {failedPct.toFixed(0)}%</span>
        </span>
      </div>
    </div>
  );
}

function TopProductBar({
  title,
  revenueInPaise,
  maxRevenueInPaise,
}: {
  title: string;
  revenueInPaise: number;
  maxRevenueInPaise: number;
}) {
  const widthPct = maxRevenueInPaise > 0 ? (revenueInPaise / maxRevenueInPaise) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-sm text-ink truncate">{title}</span>
        <span className="font-mono text-sm text-ink shrink-0">₹{(revenueInPaise / 100).toLocaleString("en-IN")}</span>
      </div>
      <div className="h-1.5 bg-fog rounded-full overflow-hidden">
        <div className="h-full bg-frost rounded-full" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function RecentOrderRow({
  order,
}: {
  order: { id: string; orderNumber: number; buyerName: string; amountInPaise: number; status: string };
}) {
  const firstName = order.buyerName.split(" ")[0];
  // Deep-links into the Orders page's existing Order Number search mode —
  // the infrastructure for this already exists, so it's a plain URL, not
  // new wiring.
  const href = `/dashboard/orders?searchType=orderNumber&searchQuery=${order.orderNumber}`;

  return (
    <Link
      href={href}
      className="flex items-center justify-between py-3 border-b border-fog last:border-0 -mx-2 px-2 rounded-md hover:bg-paper transition-colors"
    >
      <div className="min-w-0">
        <p className="font-mono text-sm text-ink">#{formatOrderNumber(order.orderNumber)}</p>
        <p className="text-xs text-slate truncate">{firstName}</p>
      </div>
      {order.status === "PAID" ? (
        <span className="font-mono text-sm text-ink shrink-0">₹{(order.amountInPaise / 100).toLocaleString("en-IN")}</span>
      ) : (
        <span className="font-mono text-sm shrink-0" style={{ color: FAILED_RED }}>
          Failed
        </span>
      )}
    </Link>
  );
}
