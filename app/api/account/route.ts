import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { changeCredentialsSchema } from "@/lib/validation/auth";

export async function PATCH(req: NextRequest) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = changeCredentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.newEmail && !parsed.data.newPassword) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    await getAuthService().changeCredentials({
      userId: session.userId,
      currentPassword: parsed.data.currentPassword,
      newEmail: parsed.data.newEmail,
      newPassword: parsed.data.newPassword,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not update account" }, { status: 400 });
  }
}
