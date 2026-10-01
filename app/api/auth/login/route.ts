import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password format" }, { status: 400 });
  }

  try {
    // role is returned so the login page can route an ADMIN to /admin/legal
    // instead of /dashboard — see app/login/page.tsx. The session cookie
    // itself already carries role (see lib/session.ts); this is purely
    // for the client's one-time post-login redirect decision, not a new
    // trust boundary — every actual gate (middleware, requireAdminSession)
    // re-derives role from the verified cookie on its own, never from this
    // response body.
    const session = await getAuthService().login(parsed.data.email, parsed.data.password);
    return NextResponse.json({ ok: true, role: session.role });
  } catch (err) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
}
