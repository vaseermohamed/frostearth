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
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-frost-900">{o.buyerEmail}</p>
                  {o.buyerPhone && <p className="text-xs text-frost-500">{o.buyerPhone}</p>}
                </div>
                <div className="text-right">
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PAID: "text-green-700 bg-green-50",
    PENDING: "text-amber-700 bg-amber-50",
    FAILED: "text-red-700 bg-red-50",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] || ""}`}>
      {status}
    </span>
  );
}
