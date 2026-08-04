import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductService } from "@/lib/services/products/ProductService";
import { CartProvider } from "@/lib/cart/CartContext";
import CartWidget from "@/components/CartWidget";
import SiteFooter from "@/components/SiteFooter";

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const { store } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  return (
    <CartProvider storeSlug={store.slug}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-frost-100 bg-white">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href={`/c/${store.slug}`} className="font-display text-lg text-frost-900">
              {store.name}
            </Link>
            <CartWidget storeSlug={store.slug} />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </CartProvider>
  );
}
