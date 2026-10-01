import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { PolicyType } from "@prisma/client";
import { SaveDraftInput } from "@/lib/validation/policy";

/**
 * Every method is explicitly store-scoped, same isolation convention as
 * every other service (ProductService, OrderService, ...) — there is no
 * "current store" global, so a second real tenant can exist later with
 * zero changes here.
 *
 * The one invariant this service exists to protect: a PUBLISHED
 * PolicyVersion row is never updated again, by anything, for any reason.
 * publish() is the only method that ever moves a row to PUBLISHED, and it
 * does so exactly once per row — see the DB trigger added by hand in
 * prisma/migrations/20261001120000_add_policy_versions_and_consents for
 * the actual, code-path-independent enforcement of that; everything here
 * is written to never even attempt the forbidden update, as a second,
 * earlier line of defense.
 */
export class PolicyService {
  /** All three policy types' current published version for a store, in a fixed display order — the admin UI's three sections and the three public pages share this to stay consistent. */
  static readonly ALL_TYPES: PolicyType[] = ["TERMS", "PRIVACY", "REFUND_POLICY"];

  async getCurrentPublished(storeId: string, policyType: PolicyType) {
    return prisma.policyVersion.findFirst({
      where: { storeId, policyType, status: "PUBLISHED" },
      orderBy: { version: "desc" },
    });
  }

  /** Every version ever published for this store+type, newest first — the admin UI's collapsible history. Drafts are excluded; there is at most one at a time anyway (see getOrCreateDraft) and it's surfaced separately. */
  async listPublishedHistory(storeId: string, policyType: PolicyType) {
    return prisma.policyVersion.findMany({
      where: { storeId, policyType, status: "PUBLISHED" },
      orderBy: { version: "desc" },
    });
  }

  async getDraft(storeId: string, policyType: PolicyType) {
    return prisma.policyVersion.findFirst({
      where: { storeId, policyType, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * The admin edit flow's entry point — "Edit" always ends up here.
   * Reuses an existing unpublished draft for this exact store+policyType
   * if one exists (never creates a second one sitting alongside it);
   * otherwise seeds a brand-new draft from the current published version
   * (so editing starts from real content, not a blank textarea), or from
   * nothing at all if this store has never published this policyType yet.
   */
  async getOrCreateDraft(storeId: string, policyType: PolicyType) {
    const existing = await this.getDraft(storeId, policyType);
    if (existing) return existing;

    const published = await this.getCurrentPublished(storeId, policyType);
    return prisma.policyVersion.create({
      data: {
        storeId,
        policyType,
        title: published?.title ?? defaultTitleFor(policyType),
        content: published?.content ?? "",
        status: "DRAFT",
      },
    });
  }

  /**
   * Overwrites the one draft row's editable fields in place — never
   * touches a PUBLISHED row (enforced below, and backstopped by the DB
   * trigger regardless). This is plain content editing, not versioning;
   * version/effectiveAt/contentHash stay null until publish() runs.
   */
  async saveDraft(input: SaveDraftInput) {
    const draft = await this.getOrCreateDraft(input.storeId, input.policyType);
    if (draft.status !== "DRAFT") {
      // Can't happen via getOrCreateDraft's own logic, but asserted
      // explicitly rather than trusting that invariant silently forever.
      throw new Error("This policy version is already published and cannot be edited");
    }

    return prisma.policyVersion.update({
      where: { id: draft.id },
      data: { title: input.title, content: input.content },
    });
  }

  /**
   * Locks the current draft for this store+policyType: assigns the next
   * version number (MAX(version) + 1 across every PUBLISHED row for this
   * exact storeId+policyType pair — never global, never per-store-only,
   * never per-type-only), stamps effectiveAt = now, and computes
   * contentHash from the exact content being locked in. All in a single
   * UPDATE of the existing draft row — publishing never creates a new
   * row; the draft row IS the version being published.
   */
  async publish(storeId: string, policyType: PolicyType) {
    const draft = await this.getDraft(storeId, policyType);
    if (!draft) throw new Error("No draft to publish for this policy");
    if (!draft.title.trim() || !draft.content.trim()) {
      throw new Error("Title and content are required before publishing");
    }

    const maxVersion = await prisma.policyVersion.aggregate({
      where: { storeId, policyType, status: "PUBLISHED" },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;
    const contentHash = crypto.createHash("sha256").update(draft.content, "utf8").digest("hex");
    const effectiveAt = new Date();

    return prisma.policyVersion.update({
      where: { id: draft.id },
      data: { status: "PUBLISHED", version: nextVersion, effectiveAt, contentHash },
    });
  }

  /**
   * The order-detail dashboard page's evidence trail — every consent row
   * recorded for one order, in the fixed TERMS/PRIVACY/REFUND_POLICY
   * display order (see ALL_TYPES), not creation order, so the three rows
   * always land in the same place on screen regardless of how
   * createPendingOrder happened to write them.
   */
  async getConsentsForOrder(orderId: string) {
    const consents = await prisma.policyConsent.findMany({ where: { orderId } });
    return PolicyService.ALL_TYPES.map((type) => consents.find((c) => c.policyType === type)).filter(
      (c): c is NonNullable<typeof c> => Boolean(c)
    );
  }
}

function defaultTitleFor(policyType: PolicyType): string {
  switch (policyType) {
    case "TERMS":
      return "Terms of Service";
    case "PRIVACY":
      return "Privacy Policy";
    case "REFUND_POLICY":
      return "Refund Policy";
  }
}

export function getPolicyService() {
  return new PolicyService();
}
