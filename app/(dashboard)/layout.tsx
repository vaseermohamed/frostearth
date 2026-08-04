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
      <header className="border-b border-frost-100 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-display text-lg text-frost-900">FrostEarth</span>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="text-frost-600 hover:text-frost-900">Overview</Link>
            <Link href="/dashboard/products" className="text-frost-600 hover:text-frost-900">Products</Link>
            <Link href="/dashboard/orders" className="text-frost-600 hover:text-frost-900">Orders</Link>
            <Link href="/dashboard/settings" className="text-frost-600 hover:text-frost-900">Settings</Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
