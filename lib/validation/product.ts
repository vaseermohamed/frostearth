import { z } from "zod";

export const createProductSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(5000),
  priceInPaise: z.coerce.number().int().min(100), // min ₹1
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  title: z.string().min(3).max(200).optional(),
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
