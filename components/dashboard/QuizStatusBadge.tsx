const STYLES: Record<string, string> = {
  DRAFT: "text-slate bg-fog",
  LIVE: "text-green-700 bg-green-50",
  CLOSED: "text-slate bg-fog",
};

const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  LIVE: "Live",
  CLOSED: "Closed",
};

export default function QuizStatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STYLES[status] ?? "text-slate bg-fog"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
