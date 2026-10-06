import { NextRequest, NextResponse } from "next/server";
import { getAuthService, LoginRateLimitedError } from "@/lib/services/auth/AuthService";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password format" }, { status: 400 });
  }

  try {
    await getAuthService().login(parsed.data.email, parsed.data.password, clientIp(req));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof LoginRateLimitedError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
}

/**
 * The first x-forwarded-for entry is the client as seen by the hosting
 * platform's edge (Vercel and Netlify both set it themselves), which is
 * what the per-IP login limit keys on.
 */
function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
