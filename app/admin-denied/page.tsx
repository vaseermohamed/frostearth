import Link from "next/link";

/**
 * Deliberately OUTSIDE the app/(admin) route group. middleware.ts rewrites
 * here for any authenticated-but-non-ADMIN request to /admin/* — a true
 * edge-level short-circuit, not a conditional render inside
 * app/(admin)/layout.tsx. That distinction is load-bearing: a layout-level
 * "if not admin, render X instead of {children}" does NOT stop the nested
 * page component from executing and having its output embedded in the
 * response's RSC flight payload (confirmed by direct testing — a CREATOR
 * session hitting /admin/legal got a page that visually showed "Access
 * denied" but whose raw HTTP body still contained the real store list in
 * an inline script tag). A rewrite means the real /admin/legal page is
 * never invoked at all for a rejected request, so there is nothing of
 * its output left to leak.
 */
export default function AdminDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h1 className="font-display font-black text-2xl text-ink mb-3">Access denied</h1>
        <p className="text-slate text-sm mb-6">This area is restricted to platform admins.</p>
        <Link href="/dashboard" className="text-sm text-ink underline">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
