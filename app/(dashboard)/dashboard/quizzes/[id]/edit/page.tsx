import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getQuizService } from "@/lib/services/quizzes/QuizService";
import { formatIstDateTimeLocalInput } from "@/lib/services/orders/orderFilters";
import QuizForm from "@/components/dashboard/QuizForm";
import QuizStatusBadge from "@/components/dashboard/QuizStatusBadge";
import CloseQuizButton from "@/components/dashboard/CloseQuizButton";

export default async function EditQuizPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const quiz = await getQuizService()
    .getOwned(session!.storeId, params.id)
    .catch(() => null);
  if (!quiz) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/quizzes" className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4">
        ← Back to quizzes
      </Link>
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Edit quiz</h1>
          <QuizStatusBadge status={quiz.status} />
        </div>
        {quiz.status === "LIVE" && <CloseQuizButton quizId={quiz.id} quizTitle={quiz.title} />}
      </div>
      <QuizForm
        quizId={quiz.id}
        initial={{
          title: quiz.title,
          subject: quiz.subject,
          startsAt: formatIstDateTimeLocalInput(quiz.startsAt),
          endsAt: quiz.endsAt ? formatIstDateTimeLocalInput(quiz.endsAt) : "",
          questions: quiz.questions.map((q) => ({
            text: q.text,
            options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          })),
        }}
      />
    </div>
  );
}
