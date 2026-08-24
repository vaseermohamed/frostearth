"use client";

import { useRef, useState } from "react";

interface OptionView {
  id: string;
  text: string;
}

interface QuestionView {
  id: string;
  text: string;
  options: OptionView[];
}

type Stage = "entry" | "quiz" | "complete";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function QuizEntryFlow({
  quizId,
  title,
  subject,
  questions,
}: {
  quizId: string;
  title: string;
  subject: string;
  questions: QuestionView[];
}) {
  const [stage, setStage] = useState<Stage>("entry");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; totalQuestions: number } | null>(null);

  // Captured once, at the form's very first render — "total time taken
  // from form-load to submit" per the spec, not just time spent on the
  // questions themselves.
  const startTimeRef = useRef(Date.now());

  async function handleContinue() {
    setError(null);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!consent) {
      setError("Please agree to be contacted to continue.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/quiz/check-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, email }),
    });
    setSubmitting(false);

    if (res.ok) {
      setPhone(digitsOnly);
      setStage("quiz");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not check your entry. Try again.");
    }
  }

  async function handleSubmitQuiz() {
    setError(null);

    if (Object.keys(answers).length !== questions.length) {
      setError("Answer every question before submitting.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/quiz/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizId,
        name,
        email,
        phone,
        consent: true,
        totalTimeMs: Date.now() - startTimeRef.current,
        answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (res.ok) {
      setResult({ score: data.score, totalQuestions: data.totalQuestions });
      setStage("complete");
    } else {
      setError(typeof data.error === "string" ? data.error : "Could not submit your entry. Try again.");
    }
  }

  if (stage === "complete" && result) {
    return (
      <div className="text-center">
        <h1 className="font-display font-black text-2xl text-ink mb-2">Thanks for playing!</h1>
        <p className="text-slate mb-8">{title}</p>
        <div className="bg-white rounded-2xl border border-fog p-8 mb-6">
          <p className="font-mono text-4xl font-bold text-frost mb-1">
            {result.score}/{result.totalQuestions}
          </p>
          <p className="text-sm text-slate">Your score</p>
        </div>
        <p className="text-sm text-slate">Winners will be announced once the quiz closes.</p>
      </div>
    );
  }

  if (stage === "quiz") {
    const allAnswered = Object.keys(answers).length === questions.length;
    return (
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-slate mb-2">{subject}</p>
        <h1 className="font-display font-black text-2xl text-ink mb-8">{title}</h1>

        <div className="space-y-6 mb-8">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-2xl border border-fog p-5">
              <p className="text-sm font-medium text-ink mb-4">
                {i + 1}. {q.text}
              </p>
              <div className="space-y-2">
                {q.options.map((o) => (
                  <label key={o.id} className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      checked={answers[q.id] === o.id}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    />
                    <span className="text-ink">{o.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          onClick={handleSubmitQuiz}
          disabled={submitting || !allAnswered}
          className="w-full rounded-full bg-frost hover:opacity-90 transition-opacity text-white font-medium px-4 py-3 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit answers"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-slate mb-2">{subject}</p>
      <h1 className="font-display font-black text-2xl text-ink mb-2">{title}</h1>
      <p className="text-slate text-sm mb-8">
        {questions.length} question{questions.length === 1 ? "" : "s"} · free to enter, open to everyone.
      </p>

      <div className="bg-white rounded-2xl border border-fog p-6 space-y-3">
        <input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-full border border-fog px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-frost"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-full border border-fog px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-frost"
        />
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-full border border-fog px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-frost"
        />
        <label className="flex items-start gap-2 text-xs text-slate pt-1">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>By entering, you agree to be contacted about quiz results and future FrostEarth updates.</span>
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={submitting}
          className="w-full rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-3 py-2.5 disabled:opacity-60"
        >
          {submitting ? "Checking…" : "Start quiz"}
        </button>
      </div>
    </div>
  );
}
