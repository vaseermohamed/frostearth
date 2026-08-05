import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Belt-and-braces: middleware already guards /dashboard, this covers
  // any direct server-render path (and gives us the session for the nav).
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-fog bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-y-2">
          <span className="font-display font-black text-lg text-ink">FrostEarth</span>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link href="/dashboard" className="text-slate hover:text-ink transition-colors">Overview</Link>
            <Link href="/dashboard/products" className="text-slate hover:text-ink transition-colors">Products</Link>
            <Link href="/dashboard/products/archive" className="text-slate hover:text-ink transition-colors">Archive</Link>
            <Link href="/dashboard/orders" className="text-slate hover:text-ink transition-colors">Orders</Link>
            <Link href="/dashboard/settings" className="text-slate hover:text-ink transition-colors">Settings</Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
