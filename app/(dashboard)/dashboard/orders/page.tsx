import { getSession } from "@/lib/session";
import { getOrderService } from "@/lib/services/orders/OrderService";

export default async function OrdersPage() {
  const session = await getSession();
  const orders = await getOrderService().listForStore(session!.storeId);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Orders</h1>
      {orders.length === 0 ? (
        <p className="text-frost-500">No orders yet.</p>
      ) : (
        <div className="bg-white rounded-lg border border-frost-100 divide-y divide-frost-100">
          {orders.map((o) => (
            <div key={o.id} className="px-5 py-4">
              <div className="flex items-start justify-between mb-2 gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-frost-900">
                    #{o.orderNumber} — {o.buyerName}
                  </p>
                  <p className="text-xs text-frost-500">{o.buyerEmail}</p>
                  {o.buyerPhone && <p className="text-xs text-frost-500">{o.buyerPhone}</p>}
                  {o.razorpayPaymentId && (
                    <p className="text-xs text-frost-500 font-mono mt-1">Ref: {o.razorpayPaymentId}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium text-frost-900">
                    ₹{(o.amountInPaise / 100).toLocaleString("en-IN")}
                  </p>
                  <StatusBadge status={o.status} />
                </div>
              </div>
              <ul className="text-sm text-frost-500 pl-4 list-disc">
                {o.items.map((item) => (
                  <li key={item.id}>
                    {item.titleSnapshot} — ₹{(item.priceInPaiseSnapshot / 100).toLocaleString("en-IN")}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// PENDING orders (checkout started, payment never confirmed — abandoned
// carts, closed tabs, etc.) are shown as "Failed" here for simplicity,
// since from the creator's point of view both mean "no money received."
// The underlying PENDING status is still kept in the database for later
// analytics; this is a display-only simplification.
function StatusBadge({ status }: { status: string }) {
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
