/*
  Warnings:

  - The `orderNumber` column on the `orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "orders" DROP COLUMN "orderNumber",
ADD COLUMN     "orderNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
