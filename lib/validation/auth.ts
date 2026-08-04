import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changeCredentialsSchema = z.object({
  currentPassword: z.string().min(1),
  newEmail: z.string().email().optional(),
  newPassword: z.string().min(6).optional(),
});
export type ChangeCredentialsInput = z.infer<typeof changeCredentialsSchema>;
