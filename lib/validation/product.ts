import { z } from "zod";

/**
 * Free text, no format validation (task explicitly doesn't want strict
 * validation) — just a generous length cap. The transform is careful to
 * keep three distinct outcomes distinct:
 *   - key absent from the request entirely -> undefined (Prisma no-ops:
 *     partial updates that don't mention subjectCode, e.g. Restore's
 *     {status: "DRAFT"}, must never silently wipe an existing code)
 *   - key present but blank -> null (an explicit clear, e.g. the edit
 *     form's field was cleared and submitted — falls back to the title)
 *   - key present with text -> the trimmed string
 * Route handlers are responsible for only including the `subjectCode`
 * key at all when the caller's own request body actually has it.
 */
const subjectCodeSchema = z
  .string()
  .max(50)
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const trimmed = v.trim();
    return trimmed ? trimmed : null;
  });

export const createProductSchema = z.object({
  title: z.string().min(3).max(200),
  subjectCode: subjectCodeSchema,
  description: z.string().min(1).max(5000),
  priceInPaise: z.coerce.number().int().min(100), // min ₹1
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  subjectCode: subjectCodeSchema,
  description: z.string().min(1).max(5000).optional(),
  priceInPaise: z.coerce.number().int().min(100).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/** Validates the {fileKey, fileName} pair a product/cover upload resolves to once already in storage. */
export const productFileKeySchema = z.object({
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
});
export type ProductFileKeyInput = z.infer<typeof productFileKeySchema>;
