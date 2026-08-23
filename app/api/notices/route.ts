import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getNoticeService } from "@/lib/services/notices/NoticeService";
import { createNoticeSchema } from "@/lib/validation/notice";
import { parseIstDate } from "@/lib/services/orders/orderFilters";

export async function GET() {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const notices = await getNoticeService().listForStore(session.storeId);
  return NextResponse.json({ notices });
}

export async function POST(req: NextRequest) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  // publishedDate arrives as a raw "YYYY-MM-DD" <input type="date"> value,
  // meant as an IST calendar date — same conversion the orders dashboard's
  // date-range filter already uses (parseIstDate), not a plain ISO parse.
  const parsed = createNoticeSchema.safeParse({
    ...body,
    publishedDate: parseIstDate(body.publishedDate),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const notice = await getNoticeService().create(session.storeId, parsed.data);
    return NextResponse.json({ notice }, { status: 201 });
  } catch (err: any) {
    console.error("[notices] create failed:", err);
    return NextResponse.json({ error: "Could not save notice" }, { status: 400 });
  }
}
