import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getQuizService } from "@/lib/services/quizzes/QuizService";
import { createQuizSchema } from "@/lib/validation/quiz";

export async function GET() {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const quizzes = await getQuizService().listForStore(session.storeId);
  return NextResponse.json({ quizzes });
}

export async function POST(req: NextRequest) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = createQuizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const quiz = await getQuizService().create(session.storeId, parsed.data);
    return NextResponse.json({ quiz }, { status: 201 });
  } catch (err: any) {
    console.error("[quizzes] create failed:", err);
    return NextResponse.json({ error: "Could not save quiz" }, { status: 400 });
  }
}
