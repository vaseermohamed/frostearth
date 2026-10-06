import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { createSession, destroySession, getSession, SessionPayload } from "@/lib/session";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
const LOGIN_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Thrown instead of checking the password once too many attempts have failed recently. */
export class LoginRateLimitedError extends Error {
  constructor() {
    super("Too many failed login attempts. Please wait 15 minutes and try again.");
    this.name = "LoginRateLimitedError";
  }
}

export class AuthService {
  /**
   * Rate-limited: after MAX_FAILURES_PER_EMAIL failures for one email,
   * or MAX_FAILURES_PER_IP from one IP, within LOGIN_WINDOW_MS, further
   * attempts are refused before bcrypt runs. The per-IP limit is looser
   * so a shared network (office, mobile carrier) doesn't lock everyone
   * out; the per-email limit is what actually stops password guessing.
   */
  async login(email: string, password: string, ip: string): Promise<SessionPayload> {
    const since = new Date(Date.now() - LOGIN_WINDOW_MS);
    const [emailFailures, ipFailures] = await Promise.all([
      prisma.loginAttempt.count({ where: { email, createdAt: { gte: since } } }),
      prisma.loginAttempt.count({ where: { ip, createdAt: { gte: since } } }),
    ]);
    if (emailFailures >= MAX_FAILURES_PER_EMAIL || ipFailures >= MAX_FAILURES_PER_IP) {
      throw new LoginRateLimitedError();
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) {
      await this.recordFailedLogin(email, ip);
      throw new Error("Invalid email or password");
    }

    await prisma.loginAttempt.deleteMany({ where: { email } });

    const payload: SessionPayload = {
      userId: user.id,
      storeId: user.storeId,
      role: user.role,
      email: user.email,
    };
    await createSession(payload);
    return payload;
  }

  private async recordFailedLogin(email: string, ip: string) {
    await prisma.loginAttempt.create({ data: { email, ip } });
    // Pruning on write keeps the table small without a separate cron job.
    await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - LOGIN_ATTEMPT_RETENTION_MS) } },
    });
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
