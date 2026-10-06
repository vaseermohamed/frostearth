import Link from "next/link";

export interface LiveQuizSummary {
  title: string;
  subject: string;
  questionCount: number;
}

/**
 * Links to the real /c/{slug}/quiz page (see app/c/[slug]/quiz/page.tsx)
 * now that the quiz feature exists. When a quiz is actually LIVE, shows
 * its real title/subject/question count instead of placeholder copy —
 * when none is live, falls back to the original "coming soon" framing
 * (the public page itself also handles a no-live-quiz visit directly,
 * this is just the homepage teaser reflecting the same state so it
 * doesn't invite a click into a dead end).
 */
export default function QuizTeaserCard({
  storeSlug,
  liveQuiz,
}: {
  storeSlug: string;
  liveQuiz: LiveQuizSummary | null;
}) {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-20">
      <Link
        href={`/c/${storeSlug}/quiz`}
        className="group block rounded-2xl border border-frost/20 bg-frost/5 hover:bg-frost/10 transition-colors p-8 sm:p-10 text-center"
      >
        <p className="font-mono text-xs uppercase tracking-widest text-frost mb-3">
          {liveQuiz ? "Live now" : "Coming soon"}
        </p>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-ink mb-2">
          {liveQuiz ? liveQuiz.title : "Test yourself with a quiz"}
        </h2>
        <p className="text-sm text-slate max-w-md mx-auto mb-5">
          {liveQuiz
            ? `${liveQuiz.subject} · ${liveQuiz.questionCount} question${liveQuiz.questionCount === 1 ? "" : "s"} · free to enter`
            : "Quick practices quizzes - coming soon"}
        </p>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-frost group-hover:gap-2.5 transition-all">
          {liveQuiz ? "Play now →" : "Learn more →"}
        </span>
      </Link>
    </section>
  );
}
