import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const state = vi.hoisted(() => ({ attempts: [] as { email: string; ip: string; createdAt: Date }[], hash: "" }));

const matches = (a: { email: string; ip: string; createdAt: Date }, where: any) =>
  (where.email === undefined || a.email === where.email) &&
  (where.ip === undefined || a.ip === where.ip) &&
  (!where.createdAt?.gte || a.createdAt >= where.createdAt.gte) &&
  (!where.createdAt?.lt || a.createdAt < where.createdAt.lt);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.email === "creator@example.com"
          ? { id: "u1", storeId: "s1", role: "CREATOR", email: where.email, passwordHash: state.hash }
          : null
      ),
    },
    loginAttempt: {
      count: vi.fn(async ({ where }: any) => state.attempts.filter((a) => matches(a, where)).length),
      create: vi.fn(async ({ data }: any) => state.attempts.push({ ...data, createdAt: new Date() })),
      deleteMany: vi.fn(async ({ where }: any) => {
        state.attempts = state.attempts.filter((a) => !matches(a, where));
      }),
    },
  },
}));
vi.mock("@/lib/session", () => ({ createSession: vi.fn(), destroySession: vi.fn(), getSession: vi.fn() }));

import { AuthService, LoginRateLimitedError } from "@/lib/services/auth/AuthService";

describe("AuthService.login rate limiting", () => {
  beforeAll(async () => {
    state.hash = await bcrypt.hash("right-password", 4);
  });
  beforeEach(() => {
    state.attempts = [];
  });

  it("locks an email after 5 failures, even with the right password", async () => {
    const auth = new AuthService();
    for (let i = 0; i < 5; i++) {
      await expect(auth.login("creator@example.com", "wrong", "1.1.1.1")).rejects.toThrow(/Invalid/);
    }
    await expect(auth.login("creator@example.com", "right-password", "2.2.2.2")).rejects.toBeInstanceOf(
      LoginRateLimitedError
    );
  });

  it("locks an IP after 20 failures across different emails", async () => {
    const auth = new AuthService();
    for (let i = 0; i < 20; i++) {
      await expect(auth.login(`user${i}@example.com`, "wrong", "3.3.3.3")).rejects.toThrow(/Invalid/);
    }
    await expect(auth.login("creator@example.com", "right-password", "3.3.3.3")).rejects.toBeInstanceOf(
      LoginRateLimitedError
    );
  });

  it("clears an email's failures after a successful login", async () => {
    const auth = new AuthService();
    for (let i = 0; i < 4; i++) {
      await expect(auth.login("creator@example.com", "wrong", "1.1.1.1")).rejects.toThrow();
    }
    await expect(auth.login("creator@example.com", "right-password", "1.1.1.1")).resolves.toMatchObject({ userId: "u1" });
    expect(state.attempts).toHaveLength(0);
  });

  it("ignores failures older than the 15-minute window", async () => {
    const old = new Date(Date.now() - 16 * 60 * 1000);
    for (let i = 0; i < 5; i++) state.attempts.push({ email: "creator@example.com", ip: "1.1.1.1", createdAt: old });
    await expect(new AuthService().login("creator@example.com", "right-password", "1.1.1.1")).resolves.toBeTruthy();
  });
});
