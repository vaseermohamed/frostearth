import { toIst, MONTH_ABBR } from "@/lib/services/orders/orderFilters";

function formatIstDate(date: Date): string {
  const ist = toIst(date);
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${dd} ${MONTH_ABBR[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

export interface NoticeBoardItem {
  id: string;
  title: string;
  publishedDate: Date;
}

/** Quiet, compact list — no icons, no cards per row, per the confirmed mockup. Renders nothing at all when there's nothing active to show. */
export default function NoticeBoard({ notices }: { notices: NoticeBoardItem[] }) {
  if (notices.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 pb-20">
      <p className="font-mono text-xs uppercase tracking-widest text-slate mb-4">Notice board</p>
      <div className="divide-y divide-fog border-t border-b border-fog">
        {notices.map((n) => (
          <div key={n.id} className="flex items-baseline justify-between gap-4 py-3">
            <p className="text-sm text-ink">{n.title}</p>
            <p className="font-mono text-xs text-slate shrink-0">{formatIstDate(n.publishedDate)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
