import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getPolicyService, PolicyService } from "@/lib/services/policies/PolicyService";
import { PolicyType } from "@prisma/client";
import PolicyEditor, { PolicyVersionDTO } from "@/components/admin/PolicyEditor";

const LABELS: Record<PolicyType, string> = {
  TERMS: "Terms of Service",
  PRIVACY: "Privacy Policy",
  REFUND_POLICY: "Refund Policy",
};

export default async function AdminStoreLegalPage({ params }: { params: { storeId: string } }) {
  const store = await prisma.store.findUnique({ where: { id: params.storeId } });
  if (!store) notFound();

  const policyService = getPolicyService();

  const sections = await Promise.all(
    PolicyService.ALL_TYPES.map(async (policyType) => {
      const [published, draft, history] = await Promise.all([
        policyService.getCurrentPublished(store.id, policyType),
        policyService.getDraft(store.id, policyType),
        policyService.listPublishedHistory(store.id, policyType),
      ]);
      return { policyType, published: toDTO(published), draft: toDTO(draft), history: history.map(toDTO).filter(isDTO) };
    })
  );

  return (
    <div>
      <Link href="/admin/legal" className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink transition-colors mb-4">
        ← All stores
      </Link>
      <h1 className="text-2xl font-semibold mb-1">{store.name}</h1>
      <p className="text-xs text-slate font-mono mb-6">/c/{store.slug}</p>

      <div className="space-y-6">
        {sections.map(({ policyType, published, draft, history }) => (
          <PolicyEditor
            key={policyType}
            storeId={store.id}
            policyType={policyType}
            label={LABELS[policyType]}
            published={published}
            draft={draft}
            history={history}
          />
        ))}
      </div>
    </div>
  );
}

function toDTO(
  v: { id: string; version: number | null; title: string; content: string; status: string; effectiveAt: Date | null; contentHash: string | null } | null
): PolicyVersionDTO | null {
  if (!v) return null;
  return {
    id: v.id,
    version: v.version,
    title: v.title,
    content: v.content,
    status: v.status as "DRAFT" | "PUBLISHED",
    effectiveAt: v.effectiveAt ? v.effectiveAt.toISOString() : null,
    contentHash: v.contentHash,
  };
}

function isDTO(v: PolicyVersionDTO | null): v is PolicyVersionDTO {
  return v !== null;
}
