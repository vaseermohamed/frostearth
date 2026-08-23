import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCountdownService } from "@/lib/services/countdowns/CountdownService";
import { formatIstDateTimeLocalInput } from "@/lib/services/orders/orderFilters";
import CountdownForm from "@/components/dashboard/CountdownForm";

export default async function EditCountdownPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const countdown = await getCountdownService()
    .getOwned(session!.storeId, params.id)
    .catch(() => null);
  if (!countdown) notFound();

  return (
    <div className="max-w-lg">
      <Link href="/dashboard/countdowns" className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4">
        ← Back to countdowns
      </Link>
      <h1 className="text-2xl font-semibold mb-6">Edit countdown</h1>
      <CountdownForm
        countdownId={countdown.id}
        initial={{
          examName: countdown.examName,
          label: countdown.label,
          targetDateTime: formatIstDateTimeLocalInput(countdown.targetDateTime),
          isActive: countdown.isActive,
          displayOrder: countdown.displayOrder,
        }}
      />
    </div>
  );
}
