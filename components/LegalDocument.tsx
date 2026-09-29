import Link from "next/link";

/**
 * Shared shell for the Terms/Privacy/Refund pages — plain, readable
 * prose styling consistent with the rest of the storefront's design
 * tokens (font-display headings, text-slate body, border-fog dividers).
 * Each page supplies its own heading/section markup as children.
 */
export default function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
      <h1 className="font-display font-black text-3xl text-ink mb-2">{title}</h1>
      <p className="font-mono text-xs uppercase tracking-widest text-slate mb-10">
        Last updated {updated}
      </p>

      <div className="space-y-5 text-sm leading-relaxed text-ink [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-base [&_h2]:text-ink [&_h2]:mt-8 [&_h2]:mb-1 [&_p]:text-slate [&_li]:text-slate [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-ink [&_a]:underline">
        {children}
      </div>

      <div className="mt-12 pt-6 border-t border-fog">
        <Link href="../" className="text-sm text-ink underline">
          ← Back to store
        </Link>
      </div>
    </div>
  );
}
