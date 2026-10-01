import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getPolicyService } from "@/lib/services/policies/PolicyService";
import { saveDraftSchema } from "@/lib/validation/policy";

/**
 * Creates-or-updates the ONE draft row for a given store+policyType (see
 * PolicyService.getOrCreateDraft — never duplicates an existing draft).
 * This never touches a PUBLISHED row; PolicyService.saveDraft asserts
 * that itself, and the DB trigger backstops it regardless.
 */
export async function PUT(req: NextRequest) {
  const session = await getAuthService().requireAdminSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = saveDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const draft = await getPolicyService().saveDraft(parsed.data);
    return NextResponse.json({ draft });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not save draft" }, { status: 400 });
  }
}
