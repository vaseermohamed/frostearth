import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Three jobs:
 *
 * 1. MAINTENANCE_MODE — when set, redirects the public site to
 *    /maintenance while leaving payments, cron, and the dashboard
 *    completely unaffected. See isMaintenanceExempt below for exactly
 *    what's excluded and why. Checked first, before anything else,
 *    since it's a full-site kill switch, not something that should
 *    interact with the other two jobs.
 *
 * 2. Resolve which store a request is for, from the Host header, and
 *    forward it as `x-store-slug` so route handlers never re-derive it.
 *    - creator-name.frostearth.in  -> SUBDOMAIN tenant resolution
 *    - frostearth.in/c/creator-name -> FREE tier, handled by the route itself
 *    - custom domains             -> same header, different source
 *
 * 3. Gate the /dashboard tree behind a valid session cookie.
 *
 * The MVP only ever resolves to "founder", but the resolution *logic*
 * already exists — this is the piece that's hardest to retrofit later.
 */

const ROOT_DOMAIN = "frostearth.in";

/**
 * Prefixes exempt from the MAINTENANCE_MODE redirect. Deliberately NOT
 * an attempt to enumerate every dashboard API route by hand (products,
 * orders, quizzes, countdowns, notices, storage-proxy, account, ...) —
 * that list would silently rot every time a new dashboard route gets
 * added, and several have been added tonight alone. Instead:
 *   - /maintenance itself — avoids a redirect loop.
 *   - /login and /api/auth — the creator has to be able to reach the
 *     login page AND actually submit it during maintenance, or "the
 *     creator must still be able to log in" is impossible by
 *     construction. Neither was in the original exclusion list, but
 *     both are required for that requirement to be achievable at all.
 *   - /api/webhooks/razorpay — a live payment webhook must never be
 *     blocked.
 *   - /api/cron — scheduled jobs must keep running.
 *   - /dashboard — the actual dashboard pages.
 * Any OTHER /api/* route is allowed through only if the request
 * already carries a valid session cookie (see the check below) — the
 * same authentication check the dashboard gate itself uses, so a
 * request only bypasses maintenance mode if it's genuinely part of an
 * authenticated dashboard session, regardless of which specific route
 * it hits. A public route with no session (checkout, quiz entries,
 * download redemption, ...) still gets redirected, which is the
 * actual point — maintenance mode has to stop real public actions,
 * not just hide the pages that trigger them.
 */
const MAINTENANCE_EXEMPT_PREFIXES = ["/maintenance", "/login", "/api/auth", "/api/webhooks/razorpay", "/api/cron", "/dashboard"];

function isMaintenanceExempt(pathname: string): boolean {
  return MAINTENANCE_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const url = req.nextUrl;
  const pathname = url.pathname;

  if (process.env.MAINTENANCE_MODE === "true" && !isMaintenanceExempt(pathname)) {
    let bypassAsAuthenticatedApiCall = false;
    if (pathname.startsWith("/api/")) {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      bypassAsAuthenticatedApiCall = token ? Boolean(await verifySessionToken(token)) : false;
    }

    if (!bypassAsAuthenticatedApiCall) {
      return NextResponse.redirect(new URL("/maintenance", req.url));
    }
  }

  const requestHeaders = new Headers(req.headers);

  const subdomain = extractSubdomain(host);
  if (subdomain) {
    requestHeaders.set("x-store-slug", subdomain);
  }

  if (url.pathname.startsWith("/dashboard")) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", url.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  if (hostname === ROOT_DOMAIN || hostname === "www." + ROOT_DOMAIN) return null;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  if (hostname.endsWith("." + ROOT_DOMAIN)) {
    return hostname.slice(0, -("." + ROOT_DOMAIN).length);
  }
  // A custom domain (Premium tier) — future lookup would map this
  // hostname to a Store via Store.customDomain instead of a slug.
  return null;
}

export const config = {
  matcher: ["/dashboard/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
