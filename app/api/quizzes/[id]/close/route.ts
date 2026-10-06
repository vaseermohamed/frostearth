import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getQuizService } from "@/lib/services/quizzes/QuizService";

/** The manual "end entry-taking" action — see Quiz model comment for why there's no automatic close. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService()
    .requireSession()
    .catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const quiz = await getQuizService().close(session.storeId, params.id);
    return NextResponse.json({ quiz });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not close quiz" }, { status: 400 });
  }
}
