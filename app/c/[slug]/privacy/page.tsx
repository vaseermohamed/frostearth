import { notFound } from "next/navigation";
import { getProductService } from "@/lib/services/products/ProductService";
import { getPolicyService } from "@/lib/services/policies/PolicyService";
import { renderPolicyMarkdown } from "@/lib/utils/markdown";
import LegalDocument from "@/components/LegalDocument";

export default async function PrivacyPage({ params }: { params: { slug: string } }) {
  const { store } = await getProductService().listPublishedByStoreSlug(params.slug);
  if (!store) notFound();

  const policy = await getPolicyService().getCurrentPublished(store.id, "PRIVACY");

  if (!policy || !policy.effectiveAt) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
        <p className="text-slate">A Privacy Policy is not currently available for this store.</p>
      </div>
    );
  }

  return (
    <LegalDocument title={policy.title} updated={formatUpdatedDate(policy.effectiveAt)}>
      <div dangerouslySetInnerHTML={{ __html: renderPolicyMarkdown(policy.content) }} />
    </LegalDocument>
  );
}

function formatUpdatedDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}
