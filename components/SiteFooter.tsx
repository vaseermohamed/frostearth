import Link from "next/link";

/**
 * Shared footer — copyright, contact, and the creator login link tucked
 * away here rather than as a prominent homepage CTA (buyers browsing
 * the storefront don't need it front and center).
 */
export default function SiteFooter({ storeSlug }: { storeSlug: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-fog bg-paper mt-20">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate">
        <p className="font-mono text-xs">© {year} FrostEarth. All rights reserved.</p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href={`/c/${storeSlug}/terms`} className="hover:text-ink transition-colors">Terms</Link>
          <Link href={`/c/${storeSlug}/privacy`} className="hover:text-ink transition-colors">Privacy</Link>
          <Link href={`/c/${storeSlug}/refund-policy`} className="hover:text-ink transition-colors">Refunds</Link>
          <a href="mailto:hello@frostearth.in" className="hover:text-ink transition-colors">Contact us</a>
          <Link href="/login" className="hover:text-ink transition-colors">Creator login</Link>
        </div>
      </div>
    </footer>
  );
}
