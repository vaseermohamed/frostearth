import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getOrderService } from "@/lib/services/orders/OrderService";
import { parseOrderFilters, toIst, formatOrderNumber } from "@/lib/services/orders/orderFilters";

const CSV_HEADERS = [
  "Order Number",
  "Date",
  "Buyer Name",
  "Email",
  "Phone",
  "Items",
  "Amount (INR)",
  "Status",
  "Payment Reference",
];

/**
 * Same filters as the orders dashboard page (see orderFilters.ts) applied
 * to the same auth-scoped query, just rendered as CSV instead of HTML —
 * a creator exporting "Paid, this month" gets exactly that, not everything.
 */
export async function GET(req: NextRequest) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const filters = parseOrderFilters({
    fromDate: searchParams.get("fromDate") || undefined,
    toDate: searchParams.get("toDate") || undefined,
    status: searchParams.get("status") || undefined,
    productId: searchParams.get("productId") || undefined,
  });

  const orders = await getOrderService().listForStore(session.storeId, filters);

  const rows = orders.map((o) => [
    formatOrderNumber(o.orderNumber),
    formatDateDDMMYYYY(o.createdAt),
    o.buyerName,
    o.buyerEmail,
    o.buyerPhone || "",
    o.items.map((i) => i.titleSnapshot).join("; "),
    (o.amountInPaise / 100).toFixed(2),
    displayStatus(o.status),
    o.razorpayPaymentId || "",
  ]);

  // Empty result set still produces a valid CSV — just the header row,
  // never an error, so an over-narrow filter doesn't break the download.
  const csv = [CSV_HEADERS, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");

  const filename = `frostearth-orders-${formatDateDDMMYYYY(new Date())}.csv`;

  // Leading BOM so Excel on Windows reads non-ASCII buyer names correctly
  // instead of mangling them under a default non-UTF-8 codepage.
  const BOM = "﻿";
  return new NextResponse(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Same PENDING-as-FAILED collapse as the dashboard's on-screen badge (see orders page StatusBadge). */
function displayStatus(status: string): "PAID" | "FAILED" {
  return status === "PAID" ? "PAID" : "FAILED";
}

/** DD-MM-YYYY in IST — createdAt is stored in UTC, and a late-night IST sale must land on the right calendar day. */
function formatDateDDMMYYYY(date: Date): string {
  const ist = toIst(date);
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = ist.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
