import Link from "next/link";
import { getSession } from "@/lib/session";
import { getProductService } from "@/lib/services/products/ProductService";
import DeleteProductButton from "@/components/DeleteProductButton";

export default async function ProductsPage() {
  const session = await getSession();
  const products = await getProductService().listForStore(session!.storeId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          href="/dashboard/products/new"
          className="bg-frost-500 hover:bg-frost-600 text-white text-sm font-medium rounded-md px-4 py-2"
        >
          Upload product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-frost-500">Nothing uploaded yet — add your first PDF to start selling.</p>
      ) : (
        <div className="bg-white rounded-lg border border-frost-100 divide-y divide-frost-100">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-frost-900">{p.title}</p>
                <p className="text-sm text-frost-500">
                  ₹{(p.priceInPaise / 100).toLocaleString("en-IN")} · {p.status}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <Link href={`/c/founder/${p.id}`} target="_blank" className="text-frost-500 hover:text-frost-900">
                  View →
                </Link>
                <Link href={`/dashboard/products/${p.id}/edit`} className="text-frost-500 hover:text-frost-900">
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
