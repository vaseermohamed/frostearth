import { z } from "zod";

export const createCountdownSchema = z.object({
  examName: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  targetDateTime: z.coerce.date(),
  isActive: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(1000),
});
export type CreateCountdownInput = z.infer<typeof createCountdownSchema>;

export const updateCountdownSchema = z.object({
  examName: z.string().min(1).max(200).optional(),
  label: z.string().min(1).max(200).optional(),
  targetDateTime: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).max(1000).optional(),
});
export type UpdateCountdownInput = z.infer<typeof updateCountdownSchema>;
