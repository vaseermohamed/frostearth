import Link from "next/link";
import { getSession } from "@/lib/session";
import { getProductService } from "@/lib/services/products/ProductService";
import DeleteProductButton from "@/components/DeleteProductButton";
import NotebookPlaceholder from "@/components/NotebookPlaceholder";

export default async function ProductsPage() {
  const session = await getSession();
  const products = await getProductService().listActiveForStore(session!.storeId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/products/archive"
            className="text-sm text-slate hover:text-ink transition-colors"
          >
            Archive
          </Link>
          <Link
            href="/dashboard/products/new"
            className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-sm font-medium px-4 py-2"
          >
            Upload product
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="text-slate">Nothing uploaded yet — add your first PDF to start selling.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-fog divide-y divide-fog">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-fog">
                  {p.coverImageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/storage/${p.coverImageKey}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <NotebookPlaceholder className="w-full h-full" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{p.title}</p>
                  <p className="text-sm text-slate">
                    <span className="font-mono">₹{(p.priceInPaise / 100).toLocaleString("en-IN")}</span> · {p.status}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <Link href={`/c/founder/${p.id}`} target="_blank" className="text-slate hover:text-ink transition-colors">
                  View →
                </Link>
                <Link href={`/dashboard/products/${p.id}/edit`} className="text-slate hover:text-ink transition-colors">
                  Edit
                </Link>
                <DeleteProductButton productId={p.id} productTitle={p.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
