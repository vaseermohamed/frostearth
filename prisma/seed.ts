/**
 * Seeds Store #1 and its one creator user.
 * Run with: npm run prisma:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.upsert({
    where: { slug: "founder" },
    update: {},
    create: {
      name: "FrostEarth Founder Store",
      slug: "founder",
      domainType: "FREE",
    },
  });

  const email = process.env.SEED_CREATOR_EMAIL || "creator@frostearth.in";
  const password = process.env.SEED_CREATOR_PASSWORD || "changeme123";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      role: "CREATOR",
      storeId: store.id,
    },
  });

  // Platform-level admin — distinct from the per-store CREATOR above.
  // UserRole.ADMIN existed in the schema with nothing gating on it and no
  // seeded account before this (see the legal-admin-area audit); this is
  // the first real ADMIN user. Still tied to a storeId because User.storeId
  // is a required column with no platform-wide-user concept in the schema
  // yet — the admin's own storeId is otherwise unused (the admin legal area
  // reads session.role only, never session.storeId), and "founder" is a
  // harmless value to attach it to for now rather than adding a nullable
  // column for a one-user edge case.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@frostearth.in";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "adminchangeme123";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      storeId: store.id,
    },
  });

  console.log(`Seeded store "${store.slug}" and creator "${email}" (password: ${password})`);
  console.log(`Seeded platform admin "${adminEmail}" (password: ${adminPassword})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
