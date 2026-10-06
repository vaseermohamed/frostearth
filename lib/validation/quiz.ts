import { z } from "zod";

const quizOptionSchema = z.object({
  text: z.string().min(1).max(300),
  isCorrect: z.boolean(),
});

const quizQuestionSchema = z
  .object({
    text: z.string().min(1).max(500),
    displayOrder: z.coerce.number().int().min(0),
    options: z.array(quizOptionSchema).length(4, "Each question needs exactly 4 options"),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: "Exactly one option must be marked correct",
    path: ["options"],
  });

export const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  // Creating a quiz only ever sets it Draft or straight to Live —
  // Closed only makes sense as a transition FROM Live, handled by the
  // separate close action, not something you'd create a brand-new quiz
  // already in.
  status: z.enum(["DRAFT", "LIVE"]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  questions: z.array(quizQuestionSchema).min(1, "Add at least one question"),
});
export type CreateQuizInput = z.infer<typeof createQuizSchema>;

/**
 * questions is optional here specifically so the "close this quiz"
 * action can PATCH just {status: "CLOSED"} without resending the whole
 * question set — see CloseQuizButton. When present, it always REPLACES
 * every existing question (see QuizService.update) rather than being
 * diffed/merged; the schema has no per-question answer records tying
 * entries to specific rows, so wholesale replace-on-edit is safe.
 */
export const updateQuizSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(200).optional(),
  status: z.enum(["DRAFT", "LIVE", "CLOSED"]).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  questions: z.array(quizQuestionSchema).min(1, "Add at least one question").optional(),
});
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;

export const checkQuizEntrySchema = z.object({
  quizId: z.string().min(1),
  email: z.string().email().max(254),
});
export type CheckQuizEntryInput = z.infer<typeof checkQuizEntrySchema>;

export const quizEntrySchema = z.object({
  quizId: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  consent: z.literal(true, { errorMap: () => ({ message: "You must agree to be contacted to enter" }) }),
  // Client-measured (form-load to submit) — there's no server-tracked
  // "attempt started" record in this schema, so this is inherently a
  // client-reported duration, unlike score (always independently
  // recomputed server-side, see QuizService.submitEntry). Bounded to a
  // sane range so it can't be used to game the score-tiebreak with an
  // obviously fabricated value (negative, zero, or multi-day).
  totalTimeMs: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        optionId: z.string().min(1),
      })
    )
    .min(1)
    // Generous ceiling, far above any real quiz — scoring dedupes anyway
    // (see QuizService.submitEntry), this just bounds the request size.
    .max(200),
});
export type QuizEntryInput = z.infer<typeof quizEntrySchema>;
