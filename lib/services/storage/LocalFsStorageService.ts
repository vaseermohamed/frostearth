import fs from "fs/promises";
import path from "path";
import { StorageService } from "./StorageService";

/**
 * MVP implementation: files live on local disk, outside of /public so
 * they are never directly web-accessible. Reads always go through a
 * server route that enforces order/token checks first.
 */
export class LocalFsStorageService implements StorageService {
  private root: string;

  constructor(root = process.env.LOCAL_STORAGE_ROOT || "./storage") {
    this.root = path.resolve(process.cwd(), root);
  }

  private resolvePath(key: string) {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root)) {
      throw new Error("Invalid storage key (path traversal attempt)");
    }
    return resolved;
  }

  async save(key: string, data: Buffer): Promise<string> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolvePath(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // Local driver has no native signed URLs — the download route itself
    // does the authorization check (see app/api/download/[token]).
    // This method exists so ProductService/OrderService code never
    // branches on which storage driver is active.
    return `/api/storage/${encodeURIComponent(key)}`;
  }

  async getUploadUrl(key: string): Promise<string> {
    // Local disk has no native presigned PUT either — proxy through the
    // same /api/storage route (see its PUT handler) so local dev exercises
    // the identical browser-PUTs-directly-to-a-URL code path as R2 does.
    // The key is minted server-side by the authenticated presign route, so
    // knowledge of this URL is the same authorization boundary a real
    // presigned URL provides.
    return `/api/storage/${key}`;
  }
}
