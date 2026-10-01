import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getPolicyService } from "@/lib/services/policies/PolicyService";
import { policyTypeSchema } from "@/lib/validation/policy";

/** One policy type's full admin-facing state for one store: current published version, the in-progress draft (if any), and the full published history. */
export async function GET(req: NextRequest) {
  const session = await getAuthService().requireAdminSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const storeId = req.nextUrl.searchParams.get("storeId");
  const policyTypeParsed = policyTypeSchema.safeParse(req.nextUrl.searchParams.get("policyType"));
  if (!storeId || !policyTypeParsed.success) {
    return NextResponse.json({ error: "storeId and a valid policyType are required" }, { status: 400 });
  }

  const policyService = getPolicyService();
  const [published, draft, history] = await Promise.all([
    policyService.getCurrentPublished(storeId, policyTypeParsed.data),
    policyService.getDraft(storeId, policyTypeParsed.data),
    policyService.listPublishedHistory(storeId, policyTypeParsed.data),
  ]);

  return NextResponse.json({ published, draft, history });
}
