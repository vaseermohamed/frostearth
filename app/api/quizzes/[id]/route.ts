import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getQuizService } from "@/lib/services/quizzes/QuizService";
import { updateQuizSchema } from "@/lib/validation/quiz";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const quiz = await getQuizService().getOwned(session.storeId, params.id);
    return NextResponse.json({ quiz });
  } catch {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = updateQuizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const quiz = await getQuizService().update(session.storeId, params.id, parsed.data);
    return NextResponse.json({ quiz });
  } catch (err: any) {
    console.error("[quizzes] update failed:", err);
    return NextResponse.json({ error: err.message || "Could not save quiz" }, { status: 400 });
  }
}
