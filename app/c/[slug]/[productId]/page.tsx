import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import AddToCartButton from "@/components/AddToCartButton";
import NotebookPlaceholder from "@/components/NotebookPlaceholder";

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
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <Link
        href={`/c/${store.slug}`}
        className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-8"
      >
        ← Back to all products
      </Link>

      <div className="rounded-sm overflow-hidden border border-fog mb-8">
        {product.coverImageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/storage/${product.coverImageKey}`}
            alt=""
            className="w-full max-h-96 object-cover"
          />
        ) : (
          <NotebookPlaceholder className="w-full h-72" />
        )}
      </div>

      <h1 className="font-display font-black text-3xl sm:text-4xl text-ink mb-3 leading-tight">{product.title}</h1>
      <p className="text-slate whitespace-pre-wrap leading-relaxed mb-8 max-w-xl">{product.description}</p>
      <p className="font-mono text-2xl text-frost mb-8">{priceLabel}</p>
      <AddToCartButton
        productId={product.id}
        title={product.title}
        priceInPaise={product.priceInPaise}
        coverImageKey={product.coverImageKey}
      />
    </div>
  );
}
