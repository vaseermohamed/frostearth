import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import { CartProvider } from "@/lib/cart/CartContext";
import CartWidget from "@/components/CartWidget";
import SiteFooter from "@/components/SiteFooter";
import { DEFAULT_STORE_SLUG } from "@/lib/config";

/**
 * The homepage IS the storefront now — no separate marketing landing
 * page. Renders the same product-listing logic as /c/[slug], just
 * addressed at "/" for the MVP's one active store. Individual product
 * pages and the cart still live under /c/[slug]/... unchanged, so
 * nothing about the multi-tenant-ready routing had to change.
 */
export default async function HomePage() {
  const { store, products } = await getProductService().listPublishedByStoreSlug(DEFAULT_STORE_SLUG);
  if (!store) notFound();

  return (
    <CartProvider storeSlug={store.slug}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-frost-100 bg-white">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="font-display text-lg text-frost-900">
              {store.name}
            </Link>
            <CartWidget storeSlug={store.slug} />
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full grid grid-cols-1 sm:grid-cols-2 gap-5">
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
        </main>

        <SiteFooter />
      </div>
    </CartProvider>
  );
}
