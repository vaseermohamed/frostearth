// Single place that knows the MVP's one active store slug. Every
// multi-tenant-ready route (/c/[slug]/...) keeps working unchanged;
// this just tells the homepage which store to render at "/" until
// there's a real reason to make the root route tenant-aware too.
export const DEFAULT_STORE_SLUG = process.env.DEFAULT_STORE_SLUG || "founder";
