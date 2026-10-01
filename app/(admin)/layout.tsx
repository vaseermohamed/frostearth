import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";

/**
 * A distinct route group from app/(dashboard) — platform-level tools for
 * an ADMIN, not a per-store CREATOR. Deliberately its own layout/auth
 * check rather than reusing DashboardLayout: the gate here is on
 * session.role === "ADMIN" specifically, not "any valid session," and a
 * CREATOR hitting this area must see an explicit rejection, not a
 * redirect that looks like nothing happened or a silently empty page.
 * Middleware (see middleware.ts) only confirms a session exists at all
 * for /admin — the role check genuinely lives here, same belt-and-braces
 * split the dashboard layout already uses for its own gate.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?from=/admin/legal");

  if (session.role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="font-display font-black text-2xl text-ink mb-3">Access denied</h1>
          <p className="text-slate text-sm mb-6">
            This area is restricted to platform admins. Your account ({session.email}) does not have admin access.
          </p>
          <Link href="/dashboard" className="text-sm text-ink underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-fog bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-y-2">
          <span className="font-display font-black text-2xl text-ink">FrostEarth Admin</span>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link href="/admin/legal" className="text-slate hover:text-ink transition-colors">Legal policies</Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
