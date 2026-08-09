import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getStorageService } from "@/lib/services/storage";

// Vercel Cron invocations run as GET requests up to this many seconds —
// generous headroom for a bucket-listing + batched-DB-lookup job that
// touches no PDF bytes at all (see StorageService.listKeys/delete, both
// metadata-only operations).
export const maxDuration = 60;

const WATERMARK_PREFIX = "watermarked/";
const KEY_PATTERN = /^watermarked\/([^/]+)\/([^/]+)\.pdf$/;

// A hard ceiling on how many objects one invocation evaluates/deletes —
// keeps a single run well inside maxDuration even if the backlog is huge.
// This job is idempotent and runs daily (see vercel.json), so anything
// left over from hitting this cap just gets picked up by tomorrow's run;
// there's no need for resumable cursor state across invocations.
const MAX_OBJECTS_PER_RUN = 500;

// DB lookups are batched across this many objects per query pair, not
// one findMany() per object — a few round trips instead of hundreds.
const DB_BATCH_SIZE = 200;

interface ParsedKey {
  key: string;
  orderId: string;
  orderItemId: string;
}

interface Outcome {
  key: string;
  orderId?: string;
  orderItemId?: string;
  reason: string;
}

/**
 * Deletes cached watermarked PDFs (see PdfWatermarkService/DownloadService)
 * once nobody can legitimately still need them — every download token
 * ever issued for that order item has expired. Regeneration from the
 * original stored file is cheap and automatic on the next real download
 * (see DownloadService.resolveDownload), so this is purely a storage-cost
 * cleanup, never a correctness concern.
 *
 * Protected by Vercel's standard Cron Job auth convention: Vercel adds
 * `Authorization: Bearer ${CRON_SECRET}` to the request it sends, so any
 * caller without that exact header is rejected — this must never be
 * triggerable by a plain public request.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  // TEMPORARY — diagnosing a production 401 that persists despite a
  // verified-correct client request. Logs shape/length only, never the
  // actual header or secret value. Remove once the root cause is found
  // and fixed (see chat history / commit that added this).
  const envSecret = process.env.CRON_SECRET;
  const strippedHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader ?? null;
  console.log(
    "[cleanup-watermarks][DEBUG-AUTH]",
    JSON.stringify({
      hasAuthHeader: authHeader !== null,
      authHeaderLength: authHeader?.length ?? -1,
      startsWithBearerSpace: authHeader?.startsWith("Bearer ") ?? false,
      strippedHeaderLength: strippedHeader?.length ?? -1,
      envSecretDefined: envSecret !== undefined,
      envSecretLength: envSecret?.length ?? -1,
      envSecretTrimmedLength: envSecret?.trim().length ?? -1,
      envSecretHasSurroundingWhitespace: envSecret !== undefined && envSecret !== envSecret.trim(),
      lengthsMatchAfterStrip: strippedHeader !== null && envSecret !== undefined && strippedHeader.length === envSecret.length,
      lengthsMatchAfterStripAndTrim:
        strippedHeader !== null && envSecret !== undefined && strippedHeader.length === envSecret.trim().length,
      valuesMatchExactly: strippedHeader !== null && envSecret !== undefined && strippedHeader === envSecret,
      valuesMatchAfterTrimBothSides:
        strippedHeader !== null && envSecret !== undefined && strippedHeader.trim() === envSecret.trim(),
    })
  );

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "true" || process.env.CLEANUP_WATERMARKS_DRY_RUN === "true";

  const storage = getStorageService();
  const allKeys = await storage.listKeys(WATERMARK_PREFIX);
  const truncated = allKeys.length > MAX_OBJECTS_PER_RUN;
  const keysToProcess = allKeys.slice(0, MAX_OBJECTS_PER_RUN);

  const parsed: ParsedKey[] = [];
  const skipped: Outcome[] = [];

  for (const key of keysToProcess) {
    const match = key.match(KEY_PATTERN);
    if (!match) {
      skipped.push({ key, reason: "path does not parse into a recognizable orderId/orderItemId" });
      continue;
    }
    parsed.push({ key, orderId: match[1], orderItemId: match[2] });
  }

  const deleted: Outcome[] = [];
  const wouldDelete: Outcome[] = [];
  const kept: Outcome[] = [];

  for (let i = 0; i < parsed.length; i += DB_BATCH_SIZE) {
    const batch = parsed.slice(i, i + DB_BATCH_SIZE);
    const orderItemIds = batch.map((b) => b.orderItemId);

    const [existingItems, tokens] = await Promise.all([
      prisma.orderItem.findMany({ where: { id: { in: orderItemIds } }, select: { id: true } }),
      prisma.downloadToken.findMany({
        where: { orderItemId: { in: orderItemIds } },
        select: { orderItemId: true, expiresAt: true },
      }),
    ]);

    const existingItemIds = new Set(existingItems.map((i) => i.id));
    const tokensByItem = new Map<string, { expiresAt: Date }[]>();
    for (const t of tokens) {
      const list = tokensByItem.get(t.orderItemId) ?? [];
      list.push(t);
      tokensByItem.set(t.orderItemId, list);
    }

    const now = new Date();
    for (const entry of batch) {
      const base = { key: entry.key, orderId: entry.orderId, orderItemId: entry.orderItemId };

      if (!existingItemIds.has(entry.orderItemId)) {
        skipped.push({ ...base, reason: "no matching order item exists in the DB" });
        continue;
      }

      const itemTokens = tokensByItem.get(entry.orderItemId) ?? [];
      if (itemTokens.length === 0) {
        // Shouldn't happen in practice — a watermarked file only ever
        // gets created via a redeemed token (see DownloadService) — but
        // if it ever does, that's a data inconsistency worth a human
        // look, not something to delete on a vacuous "every 0 tokens
        // have expired" technicality.
        skipped.push({ ...base, reason: "order item has zero download tokens on record — skipping out of caution" });
        continue;
      }

      const allExpired = itemTokens.every((t) => t.expiresAt < now);
      if (!allExpired) {
        kept.push({ ...base, reason: "at least one token for this order item has not expired yet" });
        continue;
      }

      if (dryRun) {
        wouldDelete.push({ ...base, reason: "all tokens for this order item have expired" });
        continue;
      }

      try {
        await storage.delete(entry.key);
        deleted.push({ ...base, reason: "all tokens for this order item have expired" });
      } catch (err) {
        console.error(`[cleanup-watermarks] failed to delete ${entry.key}:`, err);
        skipped.push({ ...base, reason: "delete failed — see server logs" });
      }
    }
  }

  const summary = {
    dryRun,
    totalKeysFound: allKeys.length,
    checked: keysToProcess.length,
    truncated,
    deletedCount: deleted.length,
    wouldDeleteCount: wouldDelete.length,
    keptCount: kept.length,
    skippedCount: skipped.length,
    deleted,
    wouldDelete,
    kept,
    skipped,
  };

  console.log(
    `[cleanup-watermarks] dryRun=${dryRun} totalKeysFound=${allKeys.length} checked=${keysToProcess.length} ` +
      `truncated=${truncated} deleted=${deleted.length} wouldDelete=${wouldDelete.length} kept=${kept.length} skipped=${skipped.length}`
  );

  return NextResponse.json(summary);
}
