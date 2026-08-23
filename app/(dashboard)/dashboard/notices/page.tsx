import Link from "next/link";
import { getSession } from "@/lib/session";
import { getNoticeService } from "@/lib/services/notices/NoticeService";
import { toIst, MONTH_ABBR } from "@/lib/services/orders/orderFilters";
import DeleteNoticeButton from "@/components/dashboard/DeleteNoticeButton";

function formatIstDateOnly(date: Date): string {
  const ist = toIst(date);
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${dd} ${MONTH_ABBR[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

export default async function NoticesPage() {
  const session = await getSession();
  const notices = await getNoticeService().listForStore(session!.storeId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Notices</h1>
        <Link
          href="/dashboard/notices/new"
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-4 py-2"
        >
          Add notice
        </Link>
      </div>

      {notices.length === 0 ? (
        <p className="text-slate">Nothing here yet — add a notice to show it on the homepage notice board.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-fog divide-y divide-fog">
          {notices.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium text-ink truncate">{n.title}</p>
                <p className="text-xs text-slate mt-1">
                  {formatIstDateOnly(n.publishedDate)}
                  {" · "}
                  <span className={n.isActive ? "text-frost" : "text-slate"}>{n.isActive ? "Active" : "Inactive"}</span>
                  {" · Order "}
                  {n.displayOrder}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <Link href={`/dashboard/notices/${n.id}/edit`} className="text-slate hover:text-ink transition-colors">
                  Edit
                </Link>
                <DeleteNoticeButton noticeId={n.id} title={n.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
