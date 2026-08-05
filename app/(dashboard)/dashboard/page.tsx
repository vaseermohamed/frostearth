import { getSession } from "@/lib/session";
import { getProductService } from "@/lib/services/products/ProductService";
import { getOrderService } from "@/lib/services/orders/OrderService";

export default async function DashboardOverviewPage() {
  const session = await getSession();
  const storeId = session!.storeId;

  const [products, orders] = await Promise.all([
    getProductService().listForStore(storeId),
    getOrderService().listForStore(storeId),
  ]);

  const paidOrders = orders.filter((o) => o.status === "PAID");
  const revenueInPaise = paidOrders.reduce((sum, o) => sum + o.amountInPaise, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Products" value={products.length} />
        <Stat label="Paid orders" value={paidOrders.length} />
        <Stat label="Revenue" value={`₹${(revenueInPaise / 100).toLocaleString("en-IN")}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-fog p-5">
      <p className="text-sm text-slate">{label}</p>
      <p className="font-mono text-2xl text-ink mt-1">{value}</p>
    </div>
  );
}
