import { prisma } from "@/lib/db/prisma";
import { CreateNoticeInput, UpdateNoticeInput } from "@/lib/validation/notice";

/** All methods take storeId explicitly, same isolation convention as ProductService/OrderService. */
export class NoticeService {
  async listForStore(storeId: string) {
    return prisma.notice.findMany({
      where: { storeId },
      orderBy: [{ displayOrder: "asc" }, { publishedDate: "desc" }],
    });
  }

  /** Storefront notice board feed — active rows only, creator-controlled displayOrder (manual "pinning"), not chronological. */
  async listActiveForStorefront(storeId: string) {
    return prisma.notice.findMany({
      where: { storeId, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { publishedDate: "desc" }],
    });
  }

  async getOwned(storeId: string, id: string) {
    const notice = await prisma.notice.findFirst({ where: { id, storeId } });
    if (!notice) throw new Error("Notice not found");
    return notice;
  }

  async create(storeId: string, input: CreateNoticeInput) {
    return prisma.notice.create({ data: { storeId, ...input } });
  }

  async update(storeId: string, id: string, input: UpdateNoticeInput) {
    await this.getOwned(storeId, id); // throws if not owned by this store
    return prisma.notice.update({ where: { id }, data: input });
  }

  async delete(storeId: string, id: string) {
    await this.getOwned(storeId, id);
    await prisma.notice.delete({ where: { id } });
  }
}

export function getNoticeService() {
  return new NoticeService();
}
