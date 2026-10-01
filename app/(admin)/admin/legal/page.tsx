import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

/**
 * The store selector — every store in the database, never an implicit
 * single one. An admin manages all tenants' legal policies from here;
 * nothing downstream (the per-store page, the editor, the API routes)
 * ever assumes "the" store the way the creator dashboard's own session
 * does.
 */
export default async function AdminLegalIndexPage() {
  const stores = await prisma.store.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Legal policies</h1>
      <p className="text-sm text-slate mb-6">Select a store to manage its Terms, Privacy, and Refund Policy.</p>

      {stores.length === 0 ? (
        <p className="text-slate text-sm">No stores exist yet.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-fog divide-y divide-fog">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/admin/legal/${store.id}`}
              className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-fog/40 transition-colors"
            >
              <div>
                <p className="text-ink font-medium">{store.name}</p>
                <p className="text-xs text-slate font-mono">/c/{store.slug}</p>
              </div>
              <span className="text-slate text-sm">Manage →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
