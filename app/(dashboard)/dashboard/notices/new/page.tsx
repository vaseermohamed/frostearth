import Link from "next/link";
import NoticeForm from "@/components/dashboard/NoticeForm";

export default function NewNoticePage() {
  return (
    <div className="max-w-lg">
      <Link
        href="/dashboard/notices"
        className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4"
      >
        ← Back to notices
      </Link>
      <h1 className="text-2xl font-semibold mb-6">Add notice</h1>
      <NoticeForm />
    </div>
  );
}
