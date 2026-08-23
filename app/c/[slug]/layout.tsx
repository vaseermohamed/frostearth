import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductService } from "@/lib/services/products/ProductService";
import { getCountdownService } from "@/lib/services/countdowns/CountdownService";
import { CartProvider } from "@/lib/cart/CartContext";
import CartWidget from "@/components/CartWidget";
import SiteFooter from "@/components/SiteFooter";
import CountdownCarousel from "@/components/CountdownCarousel";

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const { store } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  const countdowns = await getCountdownService().listActiveForStorefront(store.id);
  const now = Date.now();

  return (
    <CartProvider storeSlug={store.slug}>
      <div className="min-h-screen flex flex-col">
        <CountdownCarousel
          items={countdowns.map((c) => ({
            id: c.id,
            examName: c.examName,
            label: c.label,
            targetTime: c.targetDateTime.getTime(),
          }))}
          now={now}
        />
        <header className="border-b border-fog bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
            <Link
              href={`/c/${store.slug}`}
              className="font-display font-black text-2xl tracking-tight text-ink min-w-0 truncate"
            >
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
