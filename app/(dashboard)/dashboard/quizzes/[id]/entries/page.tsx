import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getQuizService } from "@/lib/services/quizzes/QuizService";
import { formatIstDateTime } from "@/lib/services/orders/orderFilters";
import QuizStatusBadge from "@/components/dashboard/QuizStatusBadge";

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export default async function QuizEntriesPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const quiz = await getQuizService()
    .getOwned(session!.storeId, params.id)
    .catch(() => null);
  if (!quiz) notFound();

  const entries = await getQuizService().listEntriesForQuiz(session!.storeId, params.id);
  const totalQuestions = quiz.questions.length;

  return (
    <div>
      <Link
        href="/dashboard/quizzes"
        className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4"
      >
        ← Back to quizzes
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-2xl font-semibold">{quiz.title}</h1>
        <QuizStatusBadge status={quiz.status} />
      </div>
      <p className="text-sm text-slate mb-6">
        {entries.length} entr{entries.length === 1 ? "y" : "ies"} · ranked by score, then fastest completion time — this
        order is the winner list.
      </p>

      {entries.length === 0 ? (
        <p className="text-slate">No entries yet.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-fog overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fog text-left text-xs text-slate uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fog">
                {entries.map((e, i) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-mono text-ink">{i + 1}</td>
                    <td className="px-4 py-3 text-ink break-words">{e.name}</td>
                    <td className="px-4 py-3 text-slate break-words">{e.email}</td>
                    <td className="px-4 py-3 text-slate">{e.phone}</td>
                    <td className="px-4 py-3 font-mono text-ink">
                      {e.score}/{totalQuestions}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate">{formatDuration(e.totalTimeMs)}</td>
                    <td className="px-4 py-3 text-slate whitespace-nowrap">{formatIstDateTime(e.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
