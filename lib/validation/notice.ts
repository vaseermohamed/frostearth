import { z } from "zod";

export const createNoticeSchema = z.object({
  title: z.string().min(1).max(300),
  publishedDate: z.coerce.date(),
  isActive: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(1000),
});
export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

export const updateNoticeSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  publishedDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).max(1000).optional(),
});
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;
