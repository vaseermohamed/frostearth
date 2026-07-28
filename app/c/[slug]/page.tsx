import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";

export default async function StorefrontPage({ params }: { params: { slug: string } }) {
  const { store, products } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
      {products.length === 0 && <p className="text-frost-500">No products published yet.</p>}
      {products.map((p) => (
        <Link
          key={p.id}
          href={`/c/${store.slug}/${p.id}`}
          className="bg-white rounded-lg border border-frost-100 p-5 hover:border-frost-500 transition-colors"
        >
          {p.coverImageKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/storage/${p.coverImageKey}`}
              alt=""
              className="w-full h-40 object-cover rounded-md mb-3"
            />
          )}
          <p className="font-medium text-frost-900">{p.title}</p>
          <p className="text-clay-500 font-semibold mt-1">
            ₹{(p.priceInPaise / 100).toLocaleString("en-IN")}
          </p>
        </Link>
      ))}
    </div>
  );
}
