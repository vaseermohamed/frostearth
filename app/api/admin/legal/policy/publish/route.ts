import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getPolicyService } from "@/lib/services/policies/PolicyService";
import { publishDraftSchema } from "@/lib/validation/policy";

/** Locks the current draft for this store+policyType — assigns the next version, effectiveAt, and contentHash in one update. See PolicyService.publish. */
export async function POST(req: NextRequest) {
  const session = await getAuthService().requireAdminSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = publishDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const published = await getPolicyService().publish(parsed.data.storeId, parsed.data.policyType);
    return NextResponse.json({ published });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not publish" }, { status: 400 });
  }
}
