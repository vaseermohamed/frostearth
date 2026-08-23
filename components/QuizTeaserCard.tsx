import Link from "next/link";

/**
 * Static placeholder — the quiz feature itself doesn't exist yet, so
 * there's no real data to pull. /quiz 404s until that ships; this is
 * just the entry point. Swap the hardcoded copy/href for real data
 * (e.g. today's quiz topic, question count) once it does.
 */
export default function QuizTeaserCard() {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-20">
      <Link
        href="/quiz"
        className="group block rounded-2xl border border-frost/20 bg-frost/5 hover:bg-frost/10 transition-colors p-8 sm:p-10 text-center"
      >
        <p className="font-mono text-xs uppercase tracking-widest text-frost mb-3">Coming soon</p>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-ink mb-2">Test yourself with a quiz</h2>
        <p className="text-sm text-slate max-w-md mx-auto mb-5">
          Quick practices quizzes - coming soon
        </p>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-frost group-hover:gap-2.5 transition-all">
          Learn more →
        </span>
      </Link>
    </section>
  );
}
