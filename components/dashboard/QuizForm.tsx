"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OptionDraft {
  text: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  text: string;
  options: OptionDraft[]; // always exactly 4
}

export interface QuizFormValues {
  title: string;
  subject: string;
  startsAt: string; // <input type="datetime-local"> value, IST wall-clock
  endsAt: string; // same shape, or "" for no end date
  questions: QuestionDraft[];
}

const EMPTY_QUESTION = (): QuestionDraft => ({
  text: "",
  // First option defaults correct so the radio group always has a valid
  // selection — the creator still has to click a different one if the
  // right answer isn't whatever they type first, but nothing is ever
  // submittable with zero options marked correct.
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
});

const EMPTY_VALUES: QuizFormValues = {
  title: "",
  subject: "",
  startsAt: "",
  endsAt: "",
  questions: [EMPTY_QUESTION()],
};

export default function QuizForm({ quizId, initial }: { quizId?: string; initial?: QuizFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState<QuizFormValues>(initial ?? EMPTY_VALUES);
  const [saving, setSaving] = useState<"draft" | "live" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateQuestionText(qIndex: number, text: string) {
    setValues((v) => {
      const questions = [...v.questions];
      questions[qIndex] = { ...questions[qIndex], text };
      return { ...v, questions };
    });
  }

  function updateOptionText(qIndex: number, oIndex: number, text: string) {
    setValues((v) => {
      const questions = [...v.questions];
      const options = [...questions[qIndex].options];
      options[oIndex] = { ...options[oIndex], text };
      questions[qIndex] = { ...questions[qIndex], options };
      return { ...v, questions };
    });
  }

  function setCorrectOption(qIndex: number, oIndex: number) {
    setValues((v) => {
      const questions = [...v.questions];
      const options = questions[qIndex].options.map((o, i) => ({ ...o, isCorrect: i === oIndex }));
      questions[qIndex] = { ...questions[qIndex], options };
      return { ...v, questions };
    });
  }

  function addQuestion() {
    setValues((v) => ({ ...v, questions: [...v.questions, EMPTY_QUESTION()] }));
  }

  function removeQuestion(qIndex: number) {
    setValues((v) => ({ ...v, questions: v.questions.filter((_, i) => i !== qIndex) }));
  }

  async function handleSave(status: "DRAFT" | "LIVE") {
    setError(null);

    if (!values.title.trim() || !values.subject.trim()) {
      setError("Title and subject are required.");
      return;
    }
    if (!values.startsAt) {
      setError("Set a start date/time.");
      return;
    }
    for (const q of values.questions) {
      if (!q.text.trim() || q.options.some((o) => !o.text.trim())) {
        setError("Every question and all 4 options need text.");
        return;
      }
    }

    setSaving(status === "DRAFT" ? "draft" : "live");

    const payload = {
      title: values.title,
      subject: values.subject,
      status,
      startsAt: values.startsAt,
      endsAt: values.endsAt || null,
      questions: values.questions.map((q, i) => ({
        text: q.text,
        displayOrder: i,
        options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      })),
    };

    const url = quizId ? `/api/quizzes/${quizId}` : "/api/quizzes";
    const method = quizId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(null);

    if (res.ok) {
      router.push("/dashboard/quizzes");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Could not save quiz");
  }

  const saving_ = saving !== null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-fog p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
            placeholder="TNPSC Group 2 Prep Quiz"
            className="w-full rounded-md border border-fog px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input
            value={values.subject}
            onChange={(e) => setValues({ ...values, subject: e.target.value })}
            placeholder="Indian Polity"
            className="w-full rounded-md border border-fog px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Starts (IST)</label>
            <input
              type="datetime-local"
              value={values.startsAt}
              onChange={(e) => setValues({ ...values, startsAt: e.target.value })}
              className="w-full rounded-md border border-fog px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ends (IST, optional)</label>
            <input
              type="datetime-local"
              value={values.endsAt}
              onChange={(e) => setValues({ ...values, endsAt: e.target.value })}
              className="w-full rounded-md border border-fog px-3 py-2"
            />
            <p className="text-xs text-slate mt-1">
              Informational only — entries stop when you close the quiz below, not automatically at this time.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {values.questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-white rounded-lg border border-fog p-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-sm font-medium">Question {qIndex + 1}</label>
              {values.questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={q.text}
              onChange={(e) => updateQuestionText(qIndex, e.target.value)}
              placeholder="Question text"
              className="w-full rounded-md border border-fog px-3 py-2"
            />
            <div className="space-y-2">
              {q.options.map((o, oIndex) => (
                <label key={oIndex} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={o.isCorrect}
                    onChange={() => setCorrectOption(qIndex, oIndex)}
                    className="shrink-0"
                  />
                  <input
                    value={o.text}
                    onChange={(e) => updateOptionText(qIndex, oIndex, e.target.value)}
                    placeholder={`Option ${oIndex + 1}`}
                    className="flex-1 min-w-0 rounded-md border border-fog px-3 py-1.5 text-sm"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-slate">Select the radio next to the correct option.</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="text-sm text-frost hover:opacity-80 transition-opacity font-medium"
      >
        + Add question
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleSave("DRAFT")}
          disabled={saving_}
          className="rounded-full border border-fog hover:border-ink transition-colors text-ink font-medium px-4 py-2 disabled:opacity-60"
        >
          {saving === "draft" ? "Saving…" : "Save as Draft"}
        </button>
        <button
          type="button"
          onClick={() => handleSave("LIVE")}
          disabled={saving_}
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white font-medium px-4 py-2 disabled:opacity-60"
        >
          {saving === "live" ? "Publishing…" : "Publish (go Live)"}
        </button>
      </div>
    </div>
  );
}
