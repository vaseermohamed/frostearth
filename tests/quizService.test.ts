import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  quiz: { findUnique: vi.fn() },
  quizEntry: { findUnique: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

import { QuizService } from "@/lib/services/quizzes/QuizService";

const quiz = {
  id: "quiz1",
  status: "LIVE",
  startsAt: new Date(Date.now() - 60_000),
  endsAt: null as Date | null,
  questions: [
    {
      id: "q1",
      options: [
        { id: "q1a", isCorrect: true },
        { id: "q1b", isCorrect: false },
      ],
    },
    {
      id: "q2",
      options: [
        { id: "q2a", isCorrect: false },
        { id: "q2b", isCorrect: true },
      ],
    },
  ],
};

const baseEntry = { quizId: "quiz1", name: "A", email: "a@example.com", phone: "9876543210", totalTimeMs: 1000 };

describe("QuizService.submitEntry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.quiz.findUnique.mockResolvedValue(quiz);
    db.quizEntry.findUnique.mockResolvedValue(null);
    db.quizEntry.create.mockImplementation(async ({ data }: any) => ({ id: "e1", ...data }));
  });

  it("scores correct answers", async () => {
    const entry = await new QuizService().submitEntry({
      ...baseEntry,
      answers: [
        { questionId: "q1", optionId: "q1a" },
        { questionId: "q2", optionId: "q2a" },
      ],
    } as any);
    expect(entry.score).toBe(1);
    expect(entry.totalQuestions).toBe(2);
  });

  it("counts a repeated correct answer only once", async () => {
    const answers = Array.from({ length: 50 }, () => ({ questionId: "q1", optionId: "q1a" }));
    const entry = await new QuizService().submitEntry({ ...baseEntry, answers } as any);
    expect(entry.score).toBe(1);
  });

  it("ignores answers to questions outside the quiz", async () => {
    const entry = await new QuizService().submitEntry({
      ...baseEntry,
      answers: [{ questionId: "other", optionId: "x" }],
    } as any);
    expect(entry.score).toBe(0);
  });

  it("rejects entries when the quiz is not live", async () => {
    db.quiz.findUnique.mockResolvedValue({ ...quiz, status: "CLOSED" });
    await expect(
      new QuizService().submitEntry({ ...baseEntry, answers: [{ questionId: "q1", optionId: "q1a" }] } as any),
    ).rejects.toThrow(/no longer accepting/);
  });

  it("rejects entries before the quiz starts", async () => {
    db.quiz.findUnique.mockResolvedValue({ ...quiz, startsAt: new Date(Date.now() + 60_000) });
    await expect(
      new QuizService().submitEntry({ ...baseEntry, answers: [{ questionId: "q1", optionId: "q1a" }] } as any),
    ).rejects.toThrow(/hasn't opened/);
  });

  it("rejects entries after the quiz ends", async () => {
    db.quiz.findUnique.mockResolvedValue({ ...quiz, endsAt: new Date(Date.now() - 1000) });
    await expect(
      new QuizService().submitEntry({ ...baseEntry, answers: [{ questionId: "q1", optionId: "q1a" }] } as any),
    ).rejects.toThrow(/no longer accepting/);
  });
});
