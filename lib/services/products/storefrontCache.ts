import { cache } from "react";
import { getProductService } from "./ProductService";

/**
 * De-dupes listPublishedByStoreSlug (a store lookup + a full published-
 * products findMany) within a single request. app/c/[slug]/layout.tsx
 * and whichever page renders underneath it (homepage, product detail)
 * both need `store`, and the homepage additionally needs `products` —
 * before this, each called listPublishedByStoreSlug independently,
 * paying for both queries twice per request. React's cache() memoizes
 * by arguments for the lifetime of one render pass, so every caller
 * here with the same slug shares one underlying call. This is
 * request-scoped only, same as any other use of React's cache() for
 * Server Component data fetching — it does not persist across requests
 * and is not a substitute for real caching/ISR.
 */
export const getStorefrontBySlug = cache(async (slug: string) => {
  return getProductService().listPublishedByStoreSlug(slug);
});
