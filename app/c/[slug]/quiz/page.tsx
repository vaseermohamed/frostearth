import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import { getQuizService } from "@/lib/services/quizzes/QuizService";
import QuizEntryFlow from "@/components/QuizEntryFlow";

export default async function PublicQuizPage({ params }: { params: { slug: string } }) {
  const { store } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  const quiz = await getQuizService().getLiveQuizForStore(store.id);

  if (!quiz) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 sm:py-24 text-center">
        <h1 className="font-display font-black text-2xl text-ink mb-2">No active quiz right now</h1>
        <p className="text-slate">Check back soon — new quizzes get announced on the homepage.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12 sm:py-16">
      <QuizEntryFlow
        quizId={quiz.id}
        title={quiz.title}
        subject={quiz.subject}
        questions={quiz.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
        }))}
      />
    </div>
  );
}
