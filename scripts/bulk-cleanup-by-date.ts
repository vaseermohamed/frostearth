/**
 * One-off, manual maintenance script — NOT a route, NOT deployed, NOT
 * run on any schedule. Run it locally, once, to bulk-delete cached
 * watermarked PDFs (see lib/services/watermark/PdfWatermarkService.ts /
 * lib/services/download/DownloadService.ts) for orders created before a
 * given cutoff date, to reduce R2 storage while a Vercel Pro upgrade is
 * pending.
 *
 * This is deliberately separate from
 * app/api/cron/cleanup-watermarks/route.ts, which deletes based on
 * download-token expiry (a correctness rule: safe once nobody can still
 * redeem a link), not order age. This script's rule is date-based and
 * one-time. The two are NOT merged and this script does not touch that
 * route's file or logic.
 *
 * Deletion is always safe regardless of criteria: the original stored
 * file is untouched, and DownloadService regenerates a watermarked copy
 * automatically on the next real download if one is ever needed again.
 *
 * ── Usage ──────────────────────────────────────────────────────────
 *
 * Dry run (default — ALWAYS do this first and review the output):
 *   npx tsx --env-file=.env.cleanup.local scripts/bulk-cleanup-by-date.ts --before=2026-08-09
 *
 * Real deletion (only after reviewing the dry-run output):
 *   npx tsx --env-file=.env.cleanup.local scripts/bulk-cleanup-by-date.ts --before=2026-08-09 --dry-run=false
 *
 * ── Required env vars ─────────────────────────────────────────────
 *
 * Same names used everywhere else in this codebase — nothing new:
 *   DATABASE_URL        (production Postgres — see lib/db/prisma.ts)
 *   STORAGE_DRIVER=r2    (must be "r2" to target the real bucket — see
 *                         lib/services/storage/index.ts; anything else
 *                         falls back to local disk)
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * Put these in a local-only file (e.g. `.env.cleanup.local` — already
 * covered by .gitignore's `.env.*.local` pattern) rather than your
 * shell history, and pass it via Node's built-in --env-file flag as
 * shown above. Do not reuse .env.local for this — that file is set up
 * for local dev (STORAGE_DRIVER=local, local Postgres), not production.
 */

import { prisma } from "../lib/db/prisma";
import { getStorageService } from "../lib/services/storage";
import { parseIstDate } from "../lib/services/orders/orderFilters";

const WATERMARK_PREFIX = "watermarked/";
const KEY_PATTERN = /^watermarked\/([^/]+)\/([^/]+)\.pdf$/;

// DB lookups are batched, not one query per key.
const DB_BATCH_SIZE = 200;

interface ParsedKey {
  key: string;
  orderId: string;
  orderItemId: string;
}

interface Attributed {
  key: string;
  orderId: string;
  createdAt: Date;
}

interface Skipped {
  key: string;
  reason: string;
}

function parseArgs(argv: string[]): { before: string; dryRun: boolean } {
  let before: string | undefined;
  let dryRun = true; // default true — must be explicitly set to false to delete anything

  for (const arg of argv) {
    if (arg.startsWith("--before=")) {
      before = arg.slice("--before=".length);
    } else if (arg.startsWith("--dry-run=")) {
      const value = arg.slice("--dry-run=".length).toLowerCase();
      if (value !== "true" && value !== "false") {
        throw new Error(`--dry-run must be "true" or "false", got "${value}"`);
      }
      dryRun = value === "true";
    } else {
      throw new Error(`Unrecognized argument: "${arg}". Expected --before=YYYY-MM-DD [--dry-run=false]`);
    }
  }

  if (!before) {
    throw new Error("Missing required --before=YYYY-MM-DD (e.g. --before=2026-08-09)");
  }

  return { before, dryRun };
}

async function main() {
  const { before, dryRun } = parseArgs(process.argv.slice(2));

  // Same IST-midnight semantics the rest of the app uses for date
  // boundaries (see orderFilters.parseIstDate) — "before 2026-08-09"
  // means before IST midnight on that date, not UTC midnight.
  const cutoff = parseIstDate(before);
  if (!cutoff) {
    throw new Error(`--before value "${before}" is not a valid YYYY-MM-DD date`);
  }

  const driver = process.env.STORAGE_DRIVER || "local";
  console.log(`Cutoff: keeping orders created on/after ${before} (IST midnight) — deleting anything before it.`);
  console.log(`Mode: ${dryRun ? "DRY RUN — nothing will be deleted" : "REAL DELETION"}`);
  console.log(
    `Storage driver: ${driver}${driver !== "r2" ? "  <-- NOT r2, this will act on local disk, not the real bucket" : ""}`,
  );
  console.log("");

  const storage = getStorageService();

  console.log(`Listing all keys under ${WATERMARK_PREFIX} ...`);
  const allKeys = await storage.listKeys(WATERMARK_PREFIX);
  console.log(`Found ${allKeys.length} cached watermarked file(s).\n`);

  const parsed: ParsedKey[] = [];
  const skipped: Skipped[] = [];

  for (const key of allKeys) {
    const match = key.match(KEY_PATTERN);
    if (!match) {
      skipped.push({ key, reason: "path does not parse into a recognizable orderId/orderItemId" });
      continue;
    }
    parsed.push({ key, orderId: match[1], orderItemId: match[2] });
  }

  const toDelete: Attributed[] = [];
  const kept: Attributed[] = [];

  for (let i = 0; i < parsed.length; i += DB_BATCH_SIZE) {
    const batch = parsed.slice(i, i + DB_BATCH_SIZE);
    const orderIds = Array.from(new Set(batch.map((b) => b.orderId)));

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, createdAt: true },
    });
    const createdAtByOrderId = new Map(orders.map((o) => [o.id, o.createdAt]));

    for (const entry of batch) {
      const createdAt = createdAtByOrderId.get(entry.orderId);
      if (!createdAt) {
        skipped.push({ key: entry.key, reason: `no matching order (orderId ${entry.orderId}) exists in the DB` });
        continue;
      }
      const attributed: Attributed = { key: entry.key, orderId: entry.orderId, createdAt };
      if (createdAt < cutoff) {
        toDelete.push(attributed);
      } else {
        kept.push(attributed);
      }
    }
  }

  toDelete.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  console.log(`=== ${dryRun ? "Would delete" : "Deleting"}: ${toDelete.length} file(s) ===`);
  for (const item of toDelete) {
    console.log(`  ${item.key}  (orderId=${item.orderId}, createdAt=${item.createdAt.toISOString()})`);
  }

  if (skipped.length > 0) {
    console.log(`\n=== Skipped: ${skipped.length} file(s) — not confidently attributable, left untouched ===`);
    for (const item of skipped) {
      console.warn(`  WARNING: ${item.key} — ${item.reason}`);
    }
  }

  let deletedCount = 0;
  let failedCount = 0;
  if (!dryRun) {
    console.log("\nDeleting now...");
    for (const item of toDelete) {
      try {
        await storage.delete(item.key);
        deletedCount++;
      } catch (err) {
        failedCount++;
        console.error(`  FAILED to delete ${item.key}:`, err);
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total checked:            ${allKeys.length}`);
  console.log(`Kept (on/after cutoff):   ${kept.length}`);
  console.log(`Skipped (unattributable): ${skipped.length}`);
  if (dryRun) {
    console.log(`Would delete:             ${toDelete.length}`);
    console.log("\nThis was a DRY RUN — nothing was deleted. Re-run with --dry-run=false to actually delete.");
  } else {
    console.log(`Deleted:                  ${deletedCount} / ${toDelete.length}`);
    if (failedCount > 0) console.log(`Failed:                   ${failedCount} (see errors above)`);
  }
}

main()
  .catch((err) => {
    console.error("Script failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
