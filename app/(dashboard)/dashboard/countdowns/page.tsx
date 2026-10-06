import Link from "next/link";
import { getSession } from "@/lib/session";
import { getCountdownService } from "@/lib/services/countdowns/CountdownService";
import { formatIstDateTime } from "@/lib/services/orders/orderFilters";
import DeleteCountdownButton from "@/components/dashboard/DeleteCountdownButton";

export default async function CountdownsPage() {
  const session = await getSession();
  const countdowns = await getCountdownService().listForStore(session!.storeId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Countdowns</h1>
        <Link
          href="/dashboard/countdowns/new"
          className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-4 py-2"
        >
          Add countdown
        </Link>
      </div>

      {countdowns.length === 0 ? (
        <p className="text-slate">Nothing here yet — add an exam countdown to show it on the homepage carousel.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-fog divide-y divide-fog">
          {countdowns.map((c) => {
            const expired = c.targetDateTime < new Date();
            return (
              <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{c.examName}</p>
                  <p className="text-sm text-slate truncate">{c.label}</p>
                  <p className="text-xs text-slate mt-1">
                    Target: {formatIstDateTime(c.targetDateTime)}
                    {" · "}
                    <span className={c.isActive && !expired ? "text-frost" : "text-slate"}>
                      {!c.isActive ? "Inactive" : expired ? "Expired" : "Active"}
                    </span>
                    {" · Order "}
                    {c.displayOrder}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm shrink-0">
                  <Link
                    href={`/dashboard/countdowns/${c.id}/edit`}
                    className="text-slate hover:text-ink transition-colors"
                  >
                    Edit
                  </Link>
                  <DeleteCountdownButton countdownId={c.id} examName={c.examName} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
