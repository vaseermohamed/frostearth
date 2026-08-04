import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Two jobs, both required for multi-tenancy to slot in later without a
 * rewrite:
 *
 * 1. Resolve which store a request is for, from the Host header, and
 *    forward it as `x-store-slug` so route handlers never re-derive it.
 *    - creator-name.frostearth.in  -> SUBDOMAIN tenant resolution
 *    - frostearth.in/c/creator-name -> FREE tier, handled by the route itself
 *    - custom domains             -> same header, different source
 *
 * 2. Gate the /dashboard tree behind a valid session cookie.
 *
 * The MVP only ever resolves to "founder", but the resolution *logic*
 * already exists — this is the piece that's hardest to retrofit later.
 */

const ROOT_DOMAIN = "frostearth.in";

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const url = req.nextUrl;

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
