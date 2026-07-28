import { StorageService } from "./StorageService";
import { LocalFsStorageService } from "./LocalFsStorageService";
import { R2StorageService } from "./R2StorageService";

/**
 * Factory — the ONLY place that knows which storage driver is active.
 * Local disk for dev, R2 (or any S3-compatible store) for anywhere
 * serverless/ephemeral. Nothing else in the codebase branches on this.
 */
export function getStorageService(): StorageService {
  const driver = process.env.STORAGE_DRIVER || "local";
  switch (driver) {
    case "local":
      return new LocalFsStorageService();
    case "r2":
      return new R2StorageService();
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
  }
}
