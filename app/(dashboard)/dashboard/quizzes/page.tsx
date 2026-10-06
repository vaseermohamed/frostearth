import Link from "next/link";
import { getSession } from "@/lib/session";
import { getQuizService } from "@/lib/services/quizzes/QuizService";
import QuizStatusBadge from "@/components/dashboard/QuizStatusBadge";

export default async function QuizzesPage() {
  const session = await getSession();
  const quizzes = await getQuizService().listForStore(session!.storeId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Quizzes</h1>
        <Link
          href="/dashboard/quizzes/new"
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-4 py-2"
        >
          + New
        </Link>
      </div>

      {quizzes.length === 0 ? (
        <p className="text-slate">Nothing here yet — create your first quiz to show it on the homepage.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-fog divide-y divide-fog">
          {quizzes.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink truncate">{q.title}</p>
                  <QuizStatusBadge status={q.status} />
                </div>
                <p className="text-sm text-slate mt-1">
                  {q.subject} · {q._count.questions} question{q._count.questions === 1 ? "" : "s"} · {q._count.entries}{" "}
                  entr{q._count.entries === 1 ? "y" : "ies"}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <Link
                  href={`/dashboard/quizzes/${q.id}/entries`}
                  className="text-slate hover:text-ink transition-colors"
                >
                  Entries
                </Link>
                <Link href={`/dashboard/quizzes/${q.id}/edit`} className="text-slate hover:text-ink transition-colors">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
