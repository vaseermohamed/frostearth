import { prisma } from "@/lib/db/prisma";
import { getStorageService } from "@/lib/services/storage";
import { CreateProductInput, UpdateProductInput } from "@/lib/validation/product";
import { v4 as uuid } from "uuid";

/**
 * All methods take storeId explicitly — even though the MVP only ever
 * passes one value for it. There is no "current store" global anywhere;
 * every query is scoped by an argument, so adding creator #2 later can
 * never accidentally leak creator #1's rows.
 */
export class ProductService {
  private storage = getStorageService();

  async listForStore(storeId: string) {
    return prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Public storefront listing — resolves the store by its slug (the /c/[slug] free tier). */
  async listPublishedByStoreSlug(slug: string) {
    const store = await prisma.store.findUnique({ where: { slug } });
    if (!store) return { store: null, products: [] as const };
    const products = await prisma.product.findMany({
      where: { storeId: store.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
    });
    return { store, products };
  }

  async getPublished(storeId: string, productId: string) {
    return prisma.product.findFirst({
      where: { id: productId, storeId, status: "PUBLISHED" },
    });
  }

  async getOwned(storeId: string, productId: string) {
    const product = await prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!product) throw new Error("Product not found");
    return product;
  }

  async create(
    storeId: string,
    input: CreateProductInput,
    file: { buffer: Buffer; fileName: string },
    cover?: { buffer: Buffer; fileName: string }
  ) {
    const fileKey = `products/${storeId}/${uuid()}-${sanitize(file.fileName)}`;
    await this.storage.save(fileKey, file.buffer);

    let coverImageKey: string | undefined;
    if (cover) {
      coverImageKey = `covers/${storeId}/${uuid()}-${sanitize(cover.fileName)}`;
      await this.storage.save(coverImageKey, cover.buffer);
    }

    return prisma.product.create({
      data: {
        storeId,
        title: input.title,
        description: input.description,
        priceInPaise: input.priceInPaise,
        fileKey,
        fileName: file.fileName,
        coverImageKey,
        status: "PUBLISHED",
      },
    });
  }

  async update(
    storeId: string,
    productId: string,
    input: UpdateProductInput,
    file?: { buffer: Buffer; fileName: string },
    cover?: { buffer: Buffer; fileName: string }
  ) {
    const existing = await this.getOwned(storeId, productId); // throws if not owned by this store

    const data: Record<string, unknown> = { ...input };

    if (file) {
      const fileKey = `products/${storeId}/${uuid()}-${sanitize(file.fileName)}`;
      await this.storage.save(fileKey, file.buffer);
      await this.storage.delete(existing.fileKey); // clean up the old PDF after the new one is safely saved
      data.fileKey = fileKey;
      data.fileName = file.fileName;
    }

    if (cover) {
      const coverImageKey = `covers/${storeId}/${uuid()}-${sanitize(cover.fileName)}`;
      await this.storage.save(coverImageKey, cover.buffer);
      if (existing.coverImageKey) await this.storage.delete(existing.coverImageKey);
      data.coverImageKey = coverImageKey;
    }

    return prisma.product.update({
      where: { id: productId },
      data,
    });
  }

  /**
   * A product that has never been ordered can be hard-deleted outright.
   * A product with sales history CANNOT be hard-deleted — OrderItem rows
   * reference it, and removing it would orphan real sales records (the
   * database itself enforces this via a foreign key). Instead, it's
   * archived: unpublished from the storefront but kept in the database
   * so past orders remain fully intact and auditable.
   */
  async delete(storeId: string, productId: string): Promise<{ hardDeleted: boolean }> {
    const product = await this.getOwned(storeId, productId);

    const orderCount = await prisma.orderItem.count({ where: { productId } });
    if (orderCount > 0) {
      await prisma.product.update({ where: { id: productId }, data: { status: "DRAFT" } });
      return { hardDeleted: false };
    }

    // File cleanup is best-effort: a missing object in storage (e.g. an
    // earlier upload that never actually landed there) must never block
    // removing the product record itself — that's the actual thing the
    // creator is trying to do.
    try {
      await this.storage.delete(product.fileKey);
    } catch (err) {
      console.error(`[product] failed to delete fileKey ${product.fileKey}:`, err);
    }
    if (product.coverImageKey) {
      try {
        await this.storage.delete(product.coverImageKey);
      } catch (err) {
        console.error(`[product] failed to delete coverImageKey ${product.coverImageKey}:`, err);
      }
    }

    await prisma.product.delete({ where: { id: productId } });
    return { hardDeleted: true };
  }
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function getProductService() {
  return new ProductService();
}
