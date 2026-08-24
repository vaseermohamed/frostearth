import Link from "next/link";
import QuizForm from "@/components/dashboard/QuizForm";

export default function NewQuizPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/quizzes" className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4">
        ← Back to quizzes
      </Link>
      <h1 className="text-2xl font-semibold mb-6">New quiz</h1>
      <QuizForm />
    </div>
  );
}
