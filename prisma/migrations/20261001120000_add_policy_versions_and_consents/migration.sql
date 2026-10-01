-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('TERMS', 'PRIVACY', 'REFUND_POLICY');

-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "policyType" "PolicyType" NOT NULL,
    "version" INTEGER,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_consents" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "policyType" "PolicyType" NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_storeId_policyType_version_key" ON "policy_versions"("storeId", "policyType", "version");

-- CreateIndex
CREATE INDEX "policy_versions_storeId_policyType_status_idx" ON "policy_versions"("storeId", "policyType", "status");

-- CreateIndex
CREATE INDEX "policy_consents_orderId_idx" ON "policy_consents"("orderId");

-- CreateIndex
CREATE INDEX "policy_consents_storeId_idx" ON "policy_consents"("storeId");

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_consents" ADD CONSTRAINT "policy_consents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_consents" ADD CONSTRAINT "policy_consents_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-added (not Prisma-generated): enforces that a PUBLISHED policy_versions
-- row can never be updated again, by ANY code path, including a raw UPDATE
-- that bypasses the application entirely. Prisma's schema language has no way
-- to express this, so it's added directly here, in SQL, same as any other
-- DB-level constraint Prisma can't model on its own. See the PolicyVersion
-- model comment in schema.prisma for why this exists.
CREATE OR REPLACE FUNCTION prevent_published_policy_version_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'PolicyVersion % is PUBLISHED and immutable — create a new DRAFT row instead', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER policy_versions_immutable_once_published
BEFORE UPDATE ON "policy_versions"
FOR EACH ROW
EXECUTE FUNCTION prevent_published_policy_version_update();
