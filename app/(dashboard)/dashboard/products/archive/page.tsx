import Link from "next/link";
import { getSession } from "@/lib/session";
import { getProductService } from "@/lib/services/products/ProductService";
import RestoreProductButton from "@/components/RestoreProductButton";

export default async function ArchivedProductsPage() {
  const session = await getSession();
  const products = await getProductService().listArchivedForStore(session!.storeId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Archived products</h1>
        <Link href="/dashboard/products" className="text-sm text-slate hover:text-ink transition-colors">
          ← Back to products
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-slate">
          No archived products yet — items land here automatically when you delete a product that has past orders.
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-fog divide-y divide-fog">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium text-ink truncate">{p.title}</p>
                <p className="text-sm text-slate">
                  <span className="font-mono">₹{(p.priceInPaise / 100).toLocaleString("en-IN")}</span> · Archived
                </p>
              </div>
              <RestoreProductButton productId={p.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
