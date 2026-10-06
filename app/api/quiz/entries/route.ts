import { NextRequest, NextResponse } from "next/server";
import { getQuizService } from "@/lib/services/quizzes/QuizService";
import { quizEntrySchema } from "@/lib/validation/quiz";

/**
 * Public, unauthenticated — anyone can enter a live quiz, no purchase
 * or buyer account required (see the quiz feature's design). Server-side
 * validation is the real trust boundary: the client's own form
 * validates too, but this is what actually enforces it, same pattern as
 * checkout and the admin resend route.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = quizEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const entry = await getQuizService().submitEntry(parsed.data);
    return NextResponse.json({ score: entry.score, totalQuestions: entry.totalQuestions }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not submit entry" }, { status: 400 });
  }
}
