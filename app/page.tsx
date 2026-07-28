import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-frost-100 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <span className="font-display text-lg text-frost-900">FrostEarth</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl text-frost-900 mb-3">FrostEarth</h1>
          <p className="text-frost-500 mb-6">
            Sell your notes, eBooks and PDFs directly to your audience.
          </p>
          <Link
            href="/c/founder"
            className="inline-block bg-frost-500 hover:bg-frost-600 text-white font-medium rounded-md px-6 py-2.5"
          >
            Visit Store
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
