import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getCountdownService } from "@/lib/services/countdowns/CountdownService";
import { updateCountdownSchema } from "@/lib/validation/countdown";
import { parseIstDateTimeLocal } from "@/lib/services/orders/orderFilters";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const countdown = await getCountdownService().getOwned(session.storeId, params.id);
    return NextResponse.json({ countdown });
  } catch {
    return NextResponse.json({ error: "Countdown not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = updateCountdownSchema.safeParse({
    ...body,
    targetDateTime: body.targetDateTime ? parseIstDateTimeLocal(body.targetDateTime) : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const countdown = await getCountdownService().update(session.storeId, params.id, parsed.data);
    return NextResponse.json({ countdown });
  } catch {
    return NextResponse.json({ error: "Countdown not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await getCountdownService().delete(session.storeId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not delete countdown" }, { status: 400 });
  }
}
