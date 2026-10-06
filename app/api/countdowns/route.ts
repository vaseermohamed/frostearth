import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getCountdownService } from "@/lib/services/countdowns/CountdownService";
import { createCountdownSchema } from "@/lib/validation/countdown";
import { parseIstDateTimeLocal } from "@/lib/services/orders/orderFilters";

export async function GET() {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const countdowns = await getCountdownService().listForStore(session.storeId);
  return NextResponse.json({ countdowns });
}

export async function POST(req: NextRequest) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  // targetDateTime arrives as a raw "YYYY-MM-DDTHH:mm" <input
  // type="datetime-local"> value, meant as IST wall-clock time (the
  // creator's own timezone) — must be converted to a real UTC instant
  // before z.coerce.date() ever sees it, since parsing that string
  // directly as ISO would silently treat it as UTC and be off by 5:30.
  const parsed = createCountdownSchema.safeParse({
    ...body,
    targetDateTime: parseIstDateTimeLocal(body.targetDateTime),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const countdown = await getCountdownService().create(session.storeId, parsed.data);
    return NextResponse.json({ countdown }, { status: 201 });
  } catch (err: any) {
    console.error("[countdowns] create failed:", err);
    return NextResponse.json({ error: "Could not save countdown" }, { status: 400 });
  }
}
