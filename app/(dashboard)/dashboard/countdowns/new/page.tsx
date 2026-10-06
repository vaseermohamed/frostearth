import Link from "next/link";
import CountdownForm from "@/components/dashboard/CountdownForm";

export default function NewCountdownPage() {
  return (
    <div className="max-w-lg">
      <Link
        href="/dashboard/countdowns"
        className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4"
      >
        ← Back to countdowns
      </Link>
      <h1 className="text-2xl font-semibold mb-6">Add countdown</h1>
      <CountdownForm />
    </div>
  );
}
