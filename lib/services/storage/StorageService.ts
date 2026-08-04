/**
 * Storage abstraction. Business code (ProductService, OrderService) must
 * only ever talk to this interface — never to `fs`, `@aws-sdk/*`, etc.
 * directly. Swapping local disk for S3/R2/MinIO later means writing one
 * new class here and changing zero call sites.
 */
export interface StorageService {
  /** Persists a buffer under a key and returns the key actually used. */
  save(key: string, data: Buffer): Promise<string>;

  /** Returns bytes for a stored key. Used server-side only (never expose keys to clients). */
  read(key: string): Promise<Buffer>;

  /** Removes a stored object. */
  delete(key: string): Promise<void>;

  /**
   * A URL the browser can hit directly for a short time.
   * Local implementation proxies through an API route since raw disk
   * paths aren't web-accessible; S3/R2 implementations would return a
   * real pre-signed URL. Callers never need to know the difference.
   */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
