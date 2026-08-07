import { parseIstDate } from "./orderFilters";

export type DateRangePreset = "7d" | "30d" | "90d" | "all";

/** Single source of truth for the preset buttons — the dashboard renders them from this list. */
export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export interface DashboardDateRangeParams {
  range?: string;
  fromDate?: string;
  toDate?: string;
}

export interface DashboardDateRange {
  /** undefined only for "All time" — every other range has a concrete lower bound. */
  from?: Date;
  to: Date;
  label: string;
  preset: DateRangePreset | "custom";
}

/**
 * The dashboard's single date-range source — every widget on the page
 * reads from this one resolved range, never a per-widget filter of its
 * own. Custom fromDate/toDate (the same inputs already built for the
 * Orders page filters, parsed via the exact same IST-correct
 * parseIstDate from orderFilters.ts) win over a preset when present;
 * otherwise a preset drives the range, defaulting to 30 days.
 */
export function resolveDashboardDateRange(params: DashboardDateRangeParams): DashboardDateRange {
  const customFrom = parseIstDate(params.fromDate);
  const customTo = parseIstDate(params.toDate, { endOfDay: true });
  const now = new Date();

  if (customFrom || customTo) {
    return { from: customFrom, to: customTo ?? now, label: "Custom range", preset: "custom" };
  }

  const preset = DATE_RANGE_PRESETS.some((p) => p.value === params.range) ? (params.range as DateRangePreset) : "30d";

  if (preset === "all") {
    return { from: undefined, to: now, label: "All time", preset };
  }

  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  return {
    from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    to: now,
    label: DATE_RANGE_PRESETS.find((p) => p.value === preset)!.label,
    preset,
  };
}

/**
 * The immediately preceding period of equal length, for the metrics
 * row's percentage-change indicators — e.g. a selected range of Aug 1-30
 * (30 days) compares against Jul 1-31 (the previous 30 days, ending
 * exactly 1ms before the current range starts so the two never overlap).
 * "All time" has no meaningful prior period to compare against, so this
 * returns null and the metrics row omits the delta for that selection.
 */
export function getComparisonRange(range: DashboardDateRange): { from: Date; to: Date } | null {
  if (!range.from) return null;
  const durationMs = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - durationMs),
    to: new Date(range.from.getTime() - 1),
  };
}

/** Percentage change from `previous` to `current`. null means "no baseline to compare against" (previous was 0 but current isn't) — the UI shows that as "—", not a nonsensical +Infinity%. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
