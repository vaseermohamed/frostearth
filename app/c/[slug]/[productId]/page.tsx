import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import { getStorefrontBySlug } from "@/lib/services/products/storefrontCache";
import AddToCartButton from "@/components/AddToCartButton";
import NotebookPlaceholder from "@/components/NotebookPlaceholder";

export default async function ProductPage({
  params,
}: {
  params: { slug: string; productId: string };
}) {
  const { store } = await getStorefrontBySlug(params.slug);
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

      <div className="aspect-[4/3] rounded-sm overflow-hidden border border-fog mb-8">
        {product.coverImageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/storage/${product.coverImageKey}`}
            alt=""
            width={800}
            height={600}
            fetchPriority="high"
            className="w-full h-full object-cover"
          />
        ) : (
          <NotebookPlaceholder className="w-full h-full" />
        )}
      </div>

      <h1 className="font-display font-black text-3xl sm:text-4xl text-ink mb-3 leading-tight break-words">{product.title}</h1>
      <p className="text-slate whitespace-pre-wrap break-words leading-relaxed mb-8 max-w-xl">{product.description}</p>
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
