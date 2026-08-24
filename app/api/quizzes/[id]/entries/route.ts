import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getQuizService } from "@/lib/services/quizzes/QuizService";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const entries = await getQuizService().listEntriesForQuiz(session.storeId, params.id);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
}
