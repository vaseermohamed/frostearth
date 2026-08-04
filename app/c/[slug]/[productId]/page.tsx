import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import AddToCartButton from "@/components/AddToCartButton";

export default async function ProductPage({
  params,
}: {
  params: { slug: string; productId: string };
}) {
  const { store } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  const product = await getProductService().getPublished(store.id, params.productId);
  if (!product) notFound();

  const priceLabel = `₹${(product.priceInPaise / 100).toLocaleString("en-IN")}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href={`/c/${store.slug}`} className="inline-flex items-center gap-1 text-sm text-frost-500 hover:text-frost-900 mb-6">
        ← Back to all products
      </Link>

      {product.coverImageKey && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/storage/${product.coverImageKey}`}
          alt=""
          className="w-full max-h-80 object-cover rounded-lg mb-6"
        />
      )}
      <h1 className="font-display text-3xl text-frost-900 mb-2">{product.title}</h1>
      <p className="text-frost-500 whitespace-pre-wrap mb-6">{product.description}</p>
      <p className="text-2xl font-semibold text-frost-900 mb-6">{priceLabel}</p>
      <AddToCartButton
        productId={product.id}
        title={product.title}
        priceInPaise={product.priceInPaise}
        coverImageKey={product.coverImageKey}
      />
    </div>
  );
}
