import { NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";

export async function POST() {
  await getAuthService().logout();
  return NextResponse.json({ ok: true });
}
