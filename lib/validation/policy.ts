import { z } from "zod";

export const policyTypeSchema = z.enum(["TERMS", "PRIVACY", "REFUND_POLICY"]);
export type PolicyTypeInput = z.infer<typeof policyTypeSchema>;

export const saveDraftSchema = z.object({
  storeId: z.string().min(1),
  policyType: policyTypeSchema,
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export const publishDraftSchema = z.object({
  storeId: z.string().min(1),
  policyType: policyTypeSchema,
});
export type PublishDraftInput = z.infer<typeof publishDraftSchema>;
