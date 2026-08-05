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
