// @pdf-lib/fontkit's bundled complex-script shaping engine (used for
// Indic scripts like Tamil/Devanagari, which need glyph reordering and
// ligature substitution, unlike simple Latin text) was built assuming a
// global `regeneratorRuntime` exists — Node.js doesn't provide one by
// default. Without this import, embedding Tamil/Devanagari text throws
// `ReferenceError: regeneratorRuntime is not defined` from deep inside
// fontkit's shaping state machine. This is a known, documented gap (see
// github.com/Hopding/pdf-lib issues #785 and #1419), not something
// specific to this codebase — must be imported before fontkit's shaping
// code ever runs, so it's first in this file.
import "regenerator-runtime/runtime";
import fs from "fs";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFDict, PDFName, PDFString, PDFRawStream, rgb, degrees, PDFFont, PDFPage } from "pdf-lib";
import { formatOrderNumber } from "@/lib/services/orders/orderFilters";
import { splitIntoScriptRuns, ScriptId } from "@/lib/services/watermark/scriptRuns";

export interface WatermarkData {
  orderId: string;
  orderNumber: number;
  buyerName: string;
  buyerEmail: string;
  /** Nullable — historical orders placed before phone became mandatory at checkout have none on record. Omitted cleanly from every layer below when absent, never rendered as "null"/blank. */
  buyerPhone: string | null;
}

/**
 * Pairs the pdf-lib PDFFont actually used for drawing with a raw
 * fontkit font used ONLY to check glyph coverage ahead of time.
 *
 * This split exists because of a real, tested finding: unlike pdf-lib's
 * built-in Standard 14 fonts (which throw a WinAnsi encoding error for
 * an unrepresentable character), a custom embedded font does NOT throw
 * when asked to draw/measure a character it has no glyph for — fontkit
 * silently substitutes glyph 0 (".notdef", the standard TrueType/
 * OpenType "missing glyph" placeholder, which renders as an empty box
 * or nothing at all depending on the font). Confirmed by direct testing
 * against these exact font files: `layout("A")` returns a real glyph
 * ID, `layout("অ")` (Bengali) returns glyph ID 0. So coverage has to be
 * checked explicitly before drawing — there's no exception to catch.
 */
interface ScriptFont {
  pdfFont: PDFFont;
  hasGlyph: (codePoint: number) => boolean;
}

type FontsByScript = Record<ScriptId, ScriptFont>;

/**
 * Font files bundled alongside this module (see ./fonts/OFL.txt — all
 * three are Google's Noto Sans family, SIL Open Font License 1.1, free
 * to embed in generated documents). Read from disk once per cold start
 * and cached at module scope — the bytes never change, only the
 * per-PDFDocument embedFont() call needs to happen fresh each time.
 *
 * Confirmed working under `next build`/`next dev`'s own bundling; not
 * independently verified against Vercel's exact serverless file-tracing
 * in a live deploy — worth a smoke test on first production download
 * after this ships.
 */
const FONT_FILES: Record<ScriptId, string> = {
  latin: "NotoSans-Regular.ttf",
  tamil: "NotoSansTamil-Regular.ttf",
  devanagari: "NotoSansDevanagari-Regular.ttf",
};

let cachedFontBytes: Record<ScriptId, Buffer> | null = null;

function loadFontBytes(): Record<ScriptId, Buffer> {
  if (cachedFontBytes) return cachedFontBytes;
  const dir = path.join(process.cwd(), "lib", "services", "watermark", "fonts");
  cachedFontBytes = {
    latin: fs.readFileSync(path.join(dir, FONT_FILES.latin)),
    tamil: fs.readFileSync(path.join(dir, FONT_FILES.tamil)),
    devanagari: fs.readFileSync(path.join(dir, FONT_FILES.devanagari)),
  };
  return cachedFontBytes;
}

/**
 * Embeds the font into this specific PDFDocument AND creates a second,
 * independent fontkit font instance purely for `hasGlyphForCodePoint`
 * coverage checks (pdf-lib's embedded PDFFont doesn't expose that check
 * itself).
 *
 * Deliberately NOT using `{ subset: true }`. That was the original plan
 * (smaller output, faster save) but it's a real, confirmed bug with
 * this specific Noto Sans font: subsetting silently drops glyphs from
 * the output — e.g. embedding "Karthik Selvam" subsetted rendered as
 * "a hik Selva" (K, r, t, and the trailing m all missing), reproduced
 * with pdf-lib's own single-embed/single-draw call pattern, with
 * subsetting the only variable changed. This caused the production
 * regression where even plain-English orders' watermarks were garbled
 * — see the investigation history for the full isolation. Embedding
 * the full font is slower and larger but correct; see applyWatermark's
 * docstring for the measured cost.
 */
async function buildScriptFont(pdfDoc: PDFDocument, bytes: Buffer): Promise<ScriptFont> {
  const pdfFont = await pdfDoc.embedFont(bytes, { subset: false });
  const rawFont = fontkit.create(bytes);
  return { pdfFont, hasGlyph: (codePoint: number) => rawFont.hasGlyphForCodePoint(codePoint) };
}

/**
 * The only file in the codebase that imports pdf-lib — everything above
 * this (DownloadService) works against `applyWatermark(bytes, data)` and
 * never touches the library directly, same rule StorageService enforces
 * for the storage SDKs. Two layers of identification, independent of each
 * other by design:
 *   - visible: a low-opacity diagonal tile + a footer strip, legible
 *     enough to survive a screenshot or a re-scan without being
 *     disruptive to actually reading the notes.
 *   - metadata: buyer identity written into both the classic PDF Info
 *     dictionary (Author/Subject/Keywords, which every PDF reader/exiftool
 *     surfaces) and an embedded XMP packet, so identification survives a
 *     crop or a "print to PDF" that strips the visible layer but not
 *     metadata.
 *
 * Text rendering is multi-script: buyer name/email/phone are free text
 * with no charset restriction at checkout, and a name in Tamil or
 * Devanagari script can't be drawn with a WinAnsi-encoded standard font
 * (pdf-lib's Helvetica etc.) at all — it throws. Custom Noto Sans fonts
 * are embedded instead, and mixed-script strings (e.g. an English word
 * next to a Tamil word) are split into per-script runs and drawn with
 * the matching font in sequence. Any script we haven't added a font for
 * yet (Bengali, Telugu, ...) falls back to the Latin font and will still
 * throw — a known, logged limitation (see prepareRuns), not silently
 * pretending full coverage.
 */
export async function applyWatermark(pdfBytes: Buffer, data: WatermarkData): Promise<Buffer> {
  // updateMetadata: false — by default pdf-lib stamps its own
  // Producer/Creator/ModDate at load time (and again on every later
  // load, including whatever tool a buyer or we open the result with),
  // which would silently clobber the identity fields this function's
  // entire job is to set. Metadata below is written explicitly instead.
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  pdfDoc.registerFontkit(fontkit);

  const bytes = loadFontBytes();
  const fonts: FontsByScript = {
    latin: await buildScriptFont(pdfDoc, bytes.latin),
    tamil: await buildScriptFont(pdfDoc, bytes.tamil),
    devanagari: await buildScriptFont(pdfDoc, bytes.devanagari),
  };

  const orderLabel = formatOrderNumber(data.orderNumber);
  const tileText = [data.buyerName, `Order ${orderLabel}`, data.buyerPhone].filter(Boolean).join(" · ");
  const footerText = [`Order ${orderLabel}`, data.buyerEmail, data.buyerPhone].filter(Boolean).join(" · ");

  // Prepared (split + coverage-checked) once, not once per page — the
  // tile/footer text is identical on every page, so there's no reason
  // to re-validate the same string 2x per page across a multi-page PDF.
  const tileRuns = prepareRuns(fonts, tileText);
  const footerRuns = prepareRuns(fonts, footerText);

  for (const page of pdfDoc.getPages()) {
    drawTiledWatermark(page, tileRuns);
    drawFooter(page, footerRuns);
  }

  // Metadata fields (Info dict + XMP) go through pdf-lib's own
  // setAuthor/setSubject/setKeywords API and a raw UTF-8 XML stream —
  // neither goes through the glyph/WinAnsi encoding path that drawText
  // does, so Tamil/Devanagari text is safe here regardless of font
  // embedding. Confirmed by testing (see investigation report), not
  // just inferred from the API shape.
  writeInfoMetadata(pdfDoc, data, orderLabel);
  writeXmpMetadata(pdfDoc, data, orderLabel);

  const outBytes = await pdfDoc.save();
  return Buffer.from(outBytes);
}

interface PreparedRun {
  font: PDFFont;
  text: string;
}

/**
 * Splits text into script runs (see scriptRuns.ts — everything outside
 * Tamil/Devanagari is bucketed as "latin") and validates every
 * character has a real glyph in its assigned font BEFORE anything is
 * drawn. Checked once per unique string, not once per tile repetition
 * or per page.
 *
 * A run whose script has no embedded font falls back to the Latin
 * font. If even Noto Sans Latin's coverage doesn't include the
 * character (a genuinely unhandled script like Bengali/Telugu, or an
 * unusual symbol/emoji), this throws a specific error naming the exact
 * character and logs a warning identifying the gap — a known,
 * documented limitation, not silently rendered as an empty box.
 */
function prepareRuns(fonts: FontsByScript, text: string): PreparedRun[] {
  const prepared: PreparedRun[] = [];

  for (const run of splitIntoScriptRuns(text)) {
    const { pdfFont, hasGlyph } = fonts[run.script];
    for (const ch of run.text) {
      if (!hasGlyph(ch.codePointAt(0)!)) {
        const codePointHex = ch.codePointAt(0)!.toString(16).toUpperCase();
        console.warn(
          `[watermark] script coverage gap: character "${ch}" (U+${codePointHex}) in "${run.text}" was bucketed as ` +
            `"${run.script}" but has no glyph in that font. Only Latin, Tamil, and Devanagari are currently ` +
            `embedded — if this is happening often, it's worth adding another script's font.`
        );
        throw new Error(`Unsupported character in watermark text: "${ch}" (U+${codePointHex}, script: ${run.script})`);
      }
    }
    prepared.push({ font: pdfFont, text: run.text });
  }

  return prepared;
}

/** Total width across however many runs a string split into — layout math (centering, tile spacing) before anything is actually drawn. */
function widthOfRuns(runs: PreparedRun[], size: number): number {
  return runs.reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0);
}

/**
 * Draws pre-validated runs in sequence starting at (x, y), advancing
 * along the given rotation angle between runs so consecutive runs of
 * different fonts stay on the same rotated baseline instead of
 * drifting horizontally (plain horizontal advancement would be wrong
 * for the rotated tile watermark). Returns the total width drawn.
 */
function drawRuns(
  page: PDFPage,
  runs: PreparedRun[],
  opts: { x: number; y: number; size: number; color: ReturnType<typeof rgb>; opacity: number; rotateDegrees?: number }
): number {
  const angleRad = ((opts.rotateDegrees ?? 0) * Math.PI) / 180;
  let advance = 0;

  for (const run of runs) {
    const runX = opts.x + advance * Math.cos(angleRad);
    const runY = opts.y + advance * Math.sin(angleRad);
    page.drawText(run.text, {
      x: runX,
      y: runY,
      size: opts.size,
      font: run.font,
      color: opts.color,
      opacity: opts.opacity,
      ...(opts.rotateDegrees ? { rotate: degrees(opts.rotateDegrees) } : {}),
    });
    advance += run.font.widthOfTextAtSize(run.text, opts.size);
  }

  return advance;
}

/**
 * Diagonal repeating tile at ~10% opacity, covering the full page
 * regardless of its size (each page is measured independently, so mixed
 * page sizes in one PDF are handled correctly). The loop deliberately
 * over-draws past all four edges — PDF viewers clip anything outside a
 * page's own MediaBox for free, so there's no need to compute the exact
 * rotated bounding box, just draw well past it.
 */
function drawTiledWatermark(page: PDFPage, runs: PreparedRun[]) {
  const { width, height } = page.getSize();
  const fontSize = 13;
  const angleDegrees = 35;
  const textWidth = widthOfRuns(runs, fontSize);
  const stepX = textWidth + 70;
  const stepY = 85;
  const diag = Math.sqrt(width * width + height * height);

  for (let y = -diag; y < diag; y += stepY) {
    for (let x = -diag; x < diag; x += stepX) {
      drawRuns(page, runs, { x, y, size: fontSize, color: rgb(0.55, 0.55, 0.55), opacity: 0.1, rotateDegrees: angleDegrees });
    }
  }
}

/** A persistent, higher-contrast strip at the bottom of every page — the part meant to be read, not just detected. */
function drawFooter(page: PDFPage, runs: PreparedRun[]) {
  const { width } = page.getSize();
  const fontSize = 8;
  const textWidth = widthOfRuns(runs, fontSize);
  drawRuns(page, runs, { x: Math.max(18, (width - textWidth) / 2), y: 16, size: fontSize, color: rgb(0.3, 0.3, 0.3), opacity: 0.9 });
}

/**
 * pdf-lib's public API only covers the standard Info fields (Author,
 * Subject, Keywords, Producer, ...). Custom keys need the lower-level
 * context/trailer API — calling the public setters first guarantees the
 * Info dict exists (pdf-lib creates it lazily on first use), so the
 * lookup right after is always safe.
 */
function writeInfoMetadata(pdfDoc: PDFDocument, data: WatermarkData, orderLabel: string) {
  const contactSuffix = data.buyerPhone ? ` · ${data.buyerPhone}` : "";
  pdfDoc.setAuthor(data.buyerName);
  pdfDoc.setSubject(`Licensed to ${data.buyerName} <${data.buyerEmail}>${contactSuffix} — Order ${orderLabel}`);
  pdfDoc.setKeywords(
    [`FrostEarth`, `Order ${orderLabel}`, data.buyerEmail, data.buyerPhone, data.orderId].filter(
      (v): v is string => Boolean(v)
    )
  );
  pdfDoc.setProducer("FrostEarth");
  pdfDoc.setModificationDate(new Date());

  const infoRef = pdfDoc.context.trailerInfo.Info;
  const infoDict = infoRef ? pdfDoc.context.lookup(infoRef, PDFDict) : undefined;
  if (infoDict) {
    infoDict.set(PDFName.of("FrostEarthOrderID"), PDFString.of(data.orderId));
    infoDict.set(PDFName.of("FrostEarthBuyerEmail"), PDFString.of(data.buyerEmail));
    if (data.buyerPhone) {
      infoDict.set(PDFName.of("FrostEarthBuyerPhone"), PDFString.of(data.buyerPhone));
    }
  }
}

/**
 * pdf-lib has no built-in XMP writer, so this hand-builds a minimal XMP
 * packet and attaches it as the catalog's /Metadata stream — the same
 * mechanism Adobe tools use, readable by exiftool and any XMP-aware
 * reader. A custom `frostearth:` namespace carries the raw order id
 * alongside the human-readable dc:/pdf: fields.
 */
function writeXmpMetadata(pdfDoc: PDFDocument, data: WatermarkData, orderLabel: string) {
  const xml = buildXmpXml(data, orderLabel);
  const bytes = Buffer.from(xml, "utf-8");
  const streamDict = pdfDoc.context.obj({ Type: "Metadata", Subtype: "XML", Length: bytes.length });
  const stream = PDFRawStream.of(streamDict, bytes);
  const streamRef = pdfDoc.context.register(stream);
  pdfDoc.catalog.set(PDFName.of("Metadata"), streamRef);
}

function buildXmpXml(data: WatermarkData, orderLabel: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const keywordParts = [`FrostEarth Order ${orderLabel}`, data.buyerEmail, data.buyerPhone, data.orderId].filter(
    (v): v is string => Boolean(v)
  );

  const lines = [
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>`,
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">`,
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`,
    `<rdf:Description rdf:about=""`,
    `  xmlns:dc="http://purl.org/dc/elements/1.1/"`,
    `  xmlns:pdf="http://ns.adobe.com/pdf/1.3/"`,
    `  xmlns:frostearth="https://frostearth.in/ns/1.0/">`,
    `<dc:creator><rdf:Seq><rdf:li>${esc(data.buyerName)}</rdf:li></rdf:Seq></dc:creator>`,
    `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${esc(data.buyerEmail)}</rdf:li></rdf:Alt></dc:description>`,
    `<pdf:Keywords>${esc(keywordParts.join("; "))}</pdf:Keywords>`,
    `<frostearth:orderId>${esc(data.orderId)}</frostearth:orderId>`,
    `<frostearth:orderNumber>${esc(orderLabel)}</frostearth:orderNumber>`,
    `<frostearth:buyerEmail>${esc(data.buyerEmail)}</frostearth:buyerEmail>`,
    `<frostearth:buyerName>${esc(data.buyerName)}</frostearth:buyerName>`,
  ];
  if (data.buyerPhone) {
    lines.push(`<frostearth:buyerPhone>${esc(data.buyerPhone)}</frostearth:buyerPhone>`);
  }
  lines.push(`</rdf:Description>`, `</rdf:RDF>`, `</x:xmpmeta>`, `<?xpacket end="w"?>`);

  return lines.join("\n");
}
