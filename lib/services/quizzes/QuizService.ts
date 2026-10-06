import { prisma } from "@/lib/db/prisma";
import { CreateQuizInput, UpdateQuizInput, QuizEntryInput } from "@/lib/validation/quiz";

/** All methods take storeId explicitly, same isolation convention as every other service. */
export class QuizService {
  /** Dashboard list — every quiz regardless of status, with question/entry counts for the summary row. */
  async listForStore(storeId: string) {
    return prisma.quiz.findMany({
      where: { storeId },
      include: { _count: { select: { questions: true, entries: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Full quiz including questions/options WITH isCorrect — the admin builder/edit view, never sent to the public quiz page as-is. */
  async getOwned(storeId: string, quizId: string) {
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, storeId },
      include: { questions: { orderBy: { displayOrder: "asc" }, include: { options: true } } },
    });
    if (!quiz) throw new Error("Quiz not found");
    return quiz;
  }

  async create(storeId: string, input: CreateQuizInput) {
    return prisma.quiz.create({
      data: {
        storeId,
        title: input.title,
        subject: input.subject,
        status: input.status,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        questions: {
          create: input.questions.map((q) => ({
            text: q.text,
            displayOrder: q.displayOrder,
            options: { create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
          })),
        },
      },
      include: { questions: { include: { options: true } } },
    });
  }

  /**
   * When `questions` is present, every existing Question/QuestionOption
   * row for this quiz is deleted and recreated from the submitted array
   * — not diffed/patched. Safe because QuizEntry has no relation to
   * specific question/option rows (see schema comment); an entry's
   * score is a frozen number by the time this could ever run again.
   * When `questions` is absent (the close-quiz action), only the
   * top-level quiz fields touch — the existing questions are untouched.
   */
  async update(storeId: string, quizId: string, input: UpdateQuizInput) {
    await this.getOwned(storeId, quizId); // throws if not owned by this store

    return prisma.$transaction(async (tx) => {
      if (input.questions) {
        await tx.question.deleteMany({ where: { quizId } }); // cascades to options
      }

      return tx.quiz.update({
        where: { id: quizId },
        data: {
          title: input.title,
          subject: input.subject,
          status: input.status,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          ...(input.questions
            ? {
                questions: {
                  create: input.questions.map((q) => ({
                    text: q.text,
                    displayOrder: q.displayOrder,
                    options: { create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
                  })),
                },
              }
            : {}),
        },
        include: { questions: { include: { options: true } } },
      });
    });
  }

  /** The dedicated "end entry-taking" action — see the model comment on Quiz for why this is always manual, never automatic. */
  async close(storeId: string, quizId: string) {
    await this.getOwned(storeId, quizId);
    return prisma.quiz.update({ where: { id: quizId }, data: { status: "CLOSED" } });
  }

  /**
   * The winner list IS this sort order — score DESC, then totalTimeMs
   * ASC as the tiebreaker (fastest correct-answerer ranks higher).
   * There is no separate "select winner" step; ranking is the result.
   */
  async listEntriesForQuiz(storeId: string, quizId: string) {
    await this.getOwned(storeId, quizId);
    return prisma.quizEntry.findMany({
      where: { quizId },
      orderBy: [{ score: "desc" }, { totalTimeMs: "asc" }],
    });
  }

  /**
   * Public-facing — the single most-recently-created LIVE quiz for this
   * store. startsAt/endsAt are NOT checked here (see the Quiz model
   * comment — status alone gates entry, deliberately no automatic
   * time-based transitions in this first version). Options are
   * returned WITHOUT isCorrect — the caller (the quiz page) must not
   * forward that field to the client under any circumstances, since
   * that's the actual answer key.
   */
  async getLiveQuizForStore(storeId: string) {
    const quiz = await prisma.quiz.findFirst({
      where: { storeId, status: "LIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        questions: {
          orderBy: { displayOrder: "asc" },
          include: { options: { select: { id: true, text: true } } },
        },
      },
    });
    return quiz;
  }

  /**
   * A pure lookup, no side effect — lets the public quiz page reject an
   * already-entered email right after the name/email/phone form (before
   * making someone answer every question only to be rejected at the
   * end). submitEntry below re-checks this same thing at final submit
   * as the real guarantee; this is purely a faster, kinder failure for
   * the common case.
   */
  async hasEntry(quizId: string, email: string): Promise<boolean> {
    const existing = await prisma.quizEntry.findUnique({ where: { quizId_email: { quizId, email } } });
    return Boolean(existing);
  }

  /**
   * Score is always recomputed here from the submitted option IDs
   * against the database's own isCorrect flags — never trusts a
   * client-submitted score, same principle as never trusting a
   * client-submitted checkout amount. totalTimeMs is the one value
   * that's inherently client-measured (see quizEntrySchema) since
   * there's no server-tracked "attempt started" record in this schema.
   */
  async submitEntry(input: QuizEntryInput) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: input.quizId },
      include: { questions: { include: { options: true } } },
    });
    if (!quiz) throw new Error("Quiz not found");
    if (quiz.status !== "LIVE") throw new Error("This quiz is no longer accepting entries");

    const existing = await prisma.quizEntry.findUnique({
      where: { quizId_email: { quizId: input.quizId, email: input.email } },
    });
    if (existing) throw new Error("You've already entered this quiz with this email address");

    const correctOptionByQuestion = new Map(
      quiz.questions.map((q) => [q.id, q.options.find((o) => o.isCorrect)?.id])
    );
    // Each question counts at most once, and only questions that belong
    // to this quiz count at all — otherwise repeating one correct answer
    // N times would score N, above the number of questions.
    const answered = new Set<string>();
    let score = 0;
    for (const answer of input.answers) {
      if (answered.has(answer.questionId) || !correctOptionByQuestion.has(answer.questionId)) continue;
      answered.add(answer.questionId);
      if (correctOptionByQuestion.get(answer.questionId) === answer.optionId) score++;
    }

    try {
      const entry = await prisma.quizEntry.create({
        data: {
          quizId: input.quizId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          score,
          totalTimeMs: input.totalTimeMs,
        },
      });
      return { ...entry, totalQuestions: quiz.questions.length };
    } catch (err: any) {
      // Backstop for a race between the proactive check above and a
      // near-simultaneous second submission from the same email — the
      // DB's own unique constraint is the real guarantee, this just
      // keeps the error message consistent with the proactive check.
      if (err?.code === "P2002") {
        throw new Error("You've already entered this quiz with this email address");
      }
      throw err;
    }
  }
}

export function getQuizService() {
  return new QuizService();
}
