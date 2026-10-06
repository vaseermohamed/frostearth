import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getNoticeService } from "@/lib/services/notices/NoticeService";
import { updateNoticeSchema } from "@/lib/validation/notice";
import { parseIstDate } from "@/lib/services/orders/orderFilters";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const notice = await getNoticeService().getOwned(session.storeId, params.id);
    return NextResponse.json({ notice });
  } catch {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = updateNoticeSchema.safeParse({
    ...body,
    publishedDate: body.publishedDate ? parseIstDate(body.publishedDate) : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const notice = await getNoticeService().update(session.storeId, params.id, parsed.data);
    return NextResponse.json({ notice });
  } catch {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await getNoticeService().delete(session.storeId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not delete notice" }, { status: 400 });
  }
}
