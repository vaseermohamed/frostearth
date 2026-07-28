import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { createSession, destroySession, getSession, SessionPayload } from "@/lib/session";

export class AuthService {
  async login(email: string, password: string): Promise<SessionPayload> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid email or password");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("Invalid email or password");

    const payload: SessionPayload = {
      userId: user.id,
      storeId: user.storeId,
      role: user.role,
      email: user.email,
    };
    await createSession(payload);
    return payload;
  }

  async logout(): Promise<void> {
    await destroySession();
  }

  async requireSession(): Promise<SessionPayload> {
    const session = await getSession();
    if (!session) throw new Error("Not authenticated");
    return session;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Changes email and/or password for the logged-in creator. Always
   * requires the current password — this is the only account-recovery
   * path in the MVP (no email reset flow yet), so a stolen session
   * cookie alone can't silently take over the account.
   */
  async changeCredentials(params: {
    userId: string;
    currentPassword: string;
    newEmail?: string;
    newPassword?: string;
  }) {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) throw new Error("Account not found");

    const valid = await bcrypt.compare(params.currentPassword, user.passwordHash);
    if (!valid) throw new Error("Current password is incorrect");

    const data: { email?: string; passwordHash?: string } = {};
    if (params.newEmail && params.newEmail !== user.email) {
      const clash = await prisma.user.findUnique({ where: { email: params.newEmail } });
      if (clash) throw new Error("That email is already in use");
      data.email = params.newEmail;
    }
    if (params.newPassword) {
      data.passwordHash = await bcrypt.hash(params.newPassword, 10);
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data });

    // Re-issue the session so its embedded email stays in sync immediately.
    await createSession({
      userId: updated.id,
      storeId: updated.storeId,
      role: updated.role,
      email: updated.email,
    });

    return updated;
  }
}

export function getAuthService() {
  return new AuthService();
}
