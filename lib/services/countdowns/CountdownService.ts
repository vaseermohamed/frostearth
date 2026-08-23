import { prisma } from "@/lib/db/prisma";
import { CreateCountdownInput, UpdateCountdownInput } from "@/lib/validation/countdown";

/** All methods take storeId explicitly, same isolation convention as ProductService/OrderService. */
export class CountdownService {
  /** Dashboard list — every row regardless of isActive, newest displayOrder logic is the creator's own concern there. */
  async listForStore(storeId: string) {
    return prisma.examCountdown.findMany({
      where: { storeId },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  /**
   * Storefront carousel feed — active rows whose targetDateTime hasn't
   * passed yet. A countdown that's merely inactive OR already expired is
   * excluded the same way; the homepage never has to reason about "is
   * this negative" itself.
   */
  async listActiveForStorefront(storeId: string) {
    return prisma.examCountdown.findMany({
      where: { storeId, isActive: true, targetDateTime: { gt: new Date() } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async getOwned(storeId: string, id: string) {
    const countdown = await prisma.examCountdown.findFirst({ where: { id, storeId } });
    if (!countdown) throw new Error("Countdown not found");
    return countdown;
  }

  async create(storeId: string, input: CreateCountdownInput) {
    return prisma.examCountdown.create({ data: { storeId, ...input } });
  }

  async update(storeId: string, id: string, input: UpdateCountdownInput) {
    await this.getOwned(storeId, id); // throws if not owned by this store
    return prisma.examCountdown.update({ where: { id }, data: input });
  }

  async delete(storeId: string, id: string) {
    await this.getOwned(storeId, id);
    await prisma.examCountdown.delete({ where: { id } });
  }
}

export function getCountdownService() {
  return new CountdownService();
}
