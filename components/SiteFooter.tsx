import Link from "next/link";

/**
 * Shared footer — copyright, contact, and the creator login link tucked
 * away here rather than as a prominent homepage CTA (buyers browsing
 * the storefront don't need it front and center).
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-frost-100 bg-white mt-16">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-frost-500">
        <p>© {year} FrostEarth. All rights reserved.</p>
        <div className="flex items-center gap-5">
          <a href="mailto:hello@frostearth.in" className="hover:text-frost-900">Contact us</a>
          <Link href="/login" className="hover:text-frost-900">Creator login</Link>
        </div>
      </div>
    </footer>
  );
}
