import { prisma } from "@/lib/db/prisma";
import { getStorageService } from "@/lib/services/storage";
import { CreateProductInput, UpdateProductInput } from "@/lib/validation/product";

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

  /** The main dashboard product list — everything except archived (DRAFT + PUBLISHED). */
  async listActiveForStore(storeId: string) {
    return prisma.product.findMany({
      where: { storeId, status: { in: ["DRAFT", "PUBLISHED"] } },
      orderBy: { createdAt: "desc" },
    });
  }

  async listArchivedForStore(storeId: string) {
    return prisma.product.findMany({
      where: { storeId, status: "ARCHIVED" },
      orderBy: { updatedAt: "desc" },
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

  /**
   * File and cover are already sitting in storage by the time this runs —
   * the browser PUTs them directly (see /api/products/upload-url), so this
   * only ever writes the DB row. Keys are minted by that presign route, not
   * here, since it's the only place that gets to decide storage layout.
   */
  async create(
    storeId: string,
    input: CreateProductInput,
    file: { key: string; fileName: string },
    cover?: { key: string }
  ) {
    return prisma.product.create({
      data: {
        storeId,
        title: input.title,
        subjectCode: input.subjectCode,
        description: input.description,
        priceInPaise: input.priceInPaise,
        fileKey: file.key,
        fileName: file.fileName,
        coverImageKey: cover?.key,
        status: "PUBLISHED",
      },
    });
  }

  async update(
    storeId: string,
    productId: string,
    input: UpdateProductInput,
    file?: { key: string; fileName: string },
    cover?: { key: string }
  ) {
    const existing = await this.getOwned(storeId, productId); // throws if not owned by this store

    const data: Record<string, unknown> = { ...input };
    if (file) {
      data.fileKey = file.key;
      data.fileName = file.fileName;
    }
    if (cover) {
      data.coverImageKey = cover.key;
    }

    const updated = await prisma.product.update({ where: { id: productId }, data });

    // Clean up replaced files only after the DB row points at the new keys,
    // and best-effort like delete() below — a storage hiccup here must never
    // block the metadata update the creator actually asked for.
    if (file) {
      try {
        await this.storage.delete(existing.fileKey);
      } catch (err) {
        console.error(`[product] failed to delete replaced fileKey ${existing.fileKey}:`, err);
      }
    }
    if (cover && existing.coverImageKey) {
      try {
        await this.storage.delete(existing.coverImageKey);
      } catch (err) {
        console.error(`[product] failed to delete replaced coverImageKey ${existing.coverImageKey}:`, err);
      }
    }

    return updated;
  }

  /**
   * A product that has never been ordered can be hard-deleted outright.
   * A product with sales history CANNOT be hard-deleted — OrderItem rows
   * reference it, and removing it would orphan real sales records (the
   * database itself enforces this via a foreign key). Instead, it's
   * archived: pulled off the storefront and out of the main dashboard
   * list, but kept in the database so past orders remain fully intact
   * and auditable. A creator can restore it (back to DRAFT) later from
   * the archive page.
   */
  async delete(storeId: string, productId: string): Promise<{ hardDeleted: boolean }> {
    const product = await this.getOwned(storeId, productId);

    const orderCount = await prisma.orderItem.count({ where: { productId } });
    if (orderCount > 0) {
      await prisma.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } });
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

/** Shared with /api/products/upload-url, which is now the only place that mints storage keys. */
export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function getProductService() {
  return new ProductService();
}
