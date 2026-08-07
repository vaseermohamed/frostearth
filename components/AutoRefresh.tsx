"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Named so the interval is one obvious place to change, not a number buried in JSX. */
export const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

/**
 * Polls the current page's server-rendered data via router.refresh() on a
 * fixed interval, instead of a real-time push mechanism (WebSockets/SSE) —
 * this app runs on serverless hosting with no long-lived connections, and
 * polling is the right-sized fit for a single-creator admin dashboard.
 * router.refresh() re-runs the current route's data fetch for its CURRENT
 * URL (including searchParams), so any active filters/search/page on the
 * Orders page survive a background refresh untouched.
 *
 * Pauses while the tab isn't visible (Page Visibility API) — no point
 * re-fetching data nobody's looking at. Renders nothing; drop it anywhere
 * in the page tree. Shared by the Orders page and the dashboard overview
 * so the polling logic lives in exactly one place.
 */
export default function AutoRefresh({ intervalMs = DEFAULT_REFRESH_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function start() {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => router.refresh(), intervalMs);
    }
    function stop() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") stop();
      else start();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, intervalMs]);

  return null;
}
