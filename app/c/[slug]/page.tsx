import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import NotebookPlaceholder from "@/components/NotebookPlaceholder";
import QuickAddButton from "@/components/QuickAddButton";

export default async function StorefrontPage({ params }: { params: { slug: string } }) {
  const { store, products } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  const recent = products.slice(0, 3);

  return (
    <div>
      <section className="max-w-6xl mx-auto px-4 pt-10 sm:pt-16 pb-14 sm:pb-20">
        <div className={`grid gap-10 lg:gap-16 items-center ${recent.length > 0 ? "lg:grid-cols-[1fr_1.3fr]" : ""}`}>
          <div className={recent.length > 0 ? "order-1 lg:order-2" : ""}>
            <p className="font-mono text-xs uppercase tracking-widest text-slate mb-4">{store.name}</p>
            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tighter text-ink mb-6">
              Notes I wish
              <br />
              someone had
              <br />
              handed me.
            </h1>
            <p className="text-slate text-base sm:text-lg max-w-md mb-8">
              Handwritten, exam-tested prep notes — the shortcuts and margin
              notes that actually got results, now yours to download.
            </p>
            {products.length > 0 && (
              <a
                href="#products"
                className="inline-flex items-center justify-center rounded-full bg-frost hover:opacity-90 transition-opacity text-white font-medium px-7 py-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                Shop the notes
              </a>
            )}
          </div>

          {recent.length > 0 && (
            <div className="order-2 lg:order-1">
              <p className="font-mono text-xs uppercase tracking-widest text-slate mb-4">By {store.name}</p>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {recent.map((p) => (
                  <Link key={p.id} href={`/c/${store.slug}/${p.id}`} className="group block">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden border border-fog mb-2 transition-colors group-hover:border-ink">
                      {p.coverImageKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/storage/${p.coverImageKey}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <NotebookPlaceholder className="w-full h-full" />
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-ink font-medium leading-snug line-clamp-2">{p.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="products" className="max-w-6xl mx-auto px-4 pb-20 scroll-mt-20">
        {products.length === 0 ? (
          <p className="text-slate">No products published yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <div
                key={p.id}
                className="relative rounded-sm border border-fog hover:border-ink focus-within:border-ink transition-colors overflow-hidden"
              >
                <Link
                  href={`/c/${store.slug}/${p.id}`}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-frost focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    {p.coverImageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/storage/${p.coverImageKey}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <NotebookPlaceholder className="w-full h-full" />
                    )}
                  </div>
                  <div className="p-5">
                    <p className="font-display font-bold text-lg text-ink mb-1.5 leading-snug">{p.title}</p>
                    <p className="font-mono text-sm text-frost">₹{(p.priceInPaise / 100).toLocaleString("en-IN")}</p>
                  </div>
                </Link>
                <QuickAddButton
                  productId={p.id}
                  title={p.title}
                  priceInPaise={p.priceInPaise}
                  coverImageKey={p.coverImageKey}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
