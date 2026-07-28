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

  console.log(`Seeded store "${store.slug}" and creator "${email}" (password: ${password})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
