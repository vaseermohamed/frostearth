import { NextRequest, NextResponse } from "next/server";
import { getQuizService } from "@/lib/services/quizzes/QuizService";
import { checkQuizEntrySchema } from "@/lib/validation/quiz";

/**
 * Public, unauthenticated — lets the quiz page reject an already-used
 * email right after the entry form, before making someone answer every
 * question only to be rejected at the end. Pure lookup, creates
 * nothing; submitEntry re-checks the same thing at final submit as the
 * actual guarantee (this is a kinder failure path, not the trust
 * boundary).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = checkQuizEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const alreadyEntered = await getQuizService().hasEntry(parsed.data.quizId, parsed.data.email);
  if (alreadyEntered) {
    return NextResponse.json({ error: "You've already entered this quiz with this email address" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
