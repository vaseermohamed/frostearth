// PENDING orders (checkout started, payment never confirmed — abandoned
// carts, closed tabs, etc.) are shown as "Failed" here for simplicity,
// since from the creator's point of view both mean "no money received."
// The underlying PENDING status is still kept in the database for later
// analytics; this is a display-only simplification, same collapse the
// Orders page filters and the CSV export already apply (see orderFilters.ts).
export default function OrderStatusBadge({ status }: { status: string }) {
  const isPaid = status === "PAID";
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        isPaid ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"
      }`}
    >
      {isPaid ? "PAID" : "FAILED"}
    </span>
  );
}
