export interface OrderFilterParams {
  fromDate?: string;
  toDate?: string;
  status?: string;
  productId?: string;
}

export interface ParsedOrderFilters {
  fromDate?: Date;
  toDate?: Date;
  status?: "PAID" | "FAILED";
  productId?: string;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Shared by the orders dashboard page and the CSV export route so both
 * apply identical filtering. Date inputs are plain "YYYY-MM-DD" values
 * from an <input type="date">, which the creator picks meaning "that day
 * in IST" — parsed and shifted to the correct UTC instant so day
 * boundaries line up correctly against createdAt (stored in UTC), not
 * shifted by the 5:30 IST offset.
 */
export function parseOrderFilters(params: OrderFilterParams): ParsedOrderFilters {
  return {
    fromDate: parseIstDate(params.fromDate),
    toDate: parseIstDate(params.toDate, { endOfDay: true }),
    status: params.status === "PAID" || params.status === "FAILED" ? params.status : undefined,
    productId: params.productId || undefined,
  };
}

function parseIstDate(value: string | undefined, opts?: { endOfDay?: boolean }): Date | undefined {
  if (!value) return undefined;
  const naiveUtcMidnight = new Date(`${value}T00:00:00.000Z`);
  if (isNaN(naiveUtcMidnight.getTime())) return undefined;

  const istMidnightAsUtc = new Date(naiveUtcMidnight.getTime() - IST_OFFSET_MS);
  if (opts?.endOfDay) {
    return new Date(istMidnightAsUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  return istMidnightAsUtc;
}

/**
 * The single shared IST-conversion primitive — everywhere else that needs
 * to display or bucket a UTC timestamp as IST (the CSV export's date
 * column, the orders page's date/time) builds on this instead of
 * re-deriving the +5:30 offset. Returns a Date whose UTC-getter fields
 * (getUTCDate/getUTCHours/etc.) read as IST wall-clock values.
 */
export function toIst(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** "05 Aug 2026, 2:34 PM" — same IST conversion as parseOrderFilters/the CSV export, just a friendlier on-screen format. */
export function formatIstDateTime(date: Date): string {
  const ist = toIst(date);
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  const month = MONTH_ABBR[ist.getUTCMonth()];
  const yyyy = ist.getUTCFullYear();

  const hours24 = ist.getUTCHours();
  const minutes = String(ist.getUTCMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${dd} ${month} ${yyyy}, ${hours12}:${minutes} ${period}`;
}

/**
 * "FE-000047" — orderNumber is now a sequential Postgres autoincrement
 * Int (see prisma/schema.prisma), zero-padded to 6 digits so small
 * numbers still read clean and every order number is the same width.
 * Shared by the dashboard orders page, the cart success screen, the CSV
 * export, and the receipt email so the format can never drift between them.
 * Has zero imports (safe from both server code and "use client" components).
 */
export function formatOrderNumber(orderNumber: number): string {
  return `FE-${orderNumber.toString().padStart(6, "0")}`;
}
