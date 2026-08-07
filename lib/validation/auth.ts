import { z } from "zod";

// Max lengths are a defensive cap, not a UX rule — bcrypt hashes/compares
// the whole string before its own internal 72-byte truncation kicks in,
// so an unbounded password field is a free CPU-cost lever for anyone who
// can hit the endpoint (no auth required to attempt a login).
const MAX_PASSWORD_LENGTH = 128;

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(MAX_PASSWORD_LENGTH),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changeCredentialsSchema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  newEmail: z.string().email().max(254).optional(),
  newPassword: z.string().min(6).max(MAX_PASSWORD_LENGTH).optional(),
});
export type ChangeCredentialsInput = z.infer<typeof changeCredentialsSchema>;
