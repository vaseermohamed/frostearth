import { NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { prisma } from "@/lib/db/prisma";

/** The admin legal area's store selector — every store, not just "founder", since an admin manages all tenants' policies. */
export async function GET() {
  const session = await getAuthService().requireAdminSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const stores = await prisma.store.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ stores });
}
