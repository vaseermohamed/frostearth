import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getNoticeService } from "@/lib/services/notices/NoticeService";
import { toIst } from "@/lib/services/orders/orderFilters";
import NoticeForm from "@/components/dashboard/NoticeForm";

/** "YYYY-MM-DD" in IST — the shape <input type="date">'s defaultValue needs, mirroring formatIstDateTimeLocalInput's role for the countdown form. */
function formatIstDateInput(date: Date): string {
  const ist = toIst(date);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function EditNoticePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const notice = await getNoticeService()
    .getOwned(session!.storeId, params.id)
    .catch(() => null);
  if (!notice) notFound();

  return (
    <div className="max-w-lg">
      <Link
        href="/dashboard/notices"
        className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4"
      >
        ← Back to notices
      </Link>
      <h1 className="text-2xl font-semibold mb-6">Edit notice</h1>
      <NoticeForm
        noticeId={notice.id}
        initial={{
          title: notice.title,
          publishedDate: formatIstDateInput(notice.publishedDate),
          isActive: notice.isActive,
          displayOrder: notice.displayOrder,
        }}
      />
    </div>
  );
}
