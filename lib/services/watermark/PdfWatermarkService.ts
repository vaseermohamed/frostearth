import { PDFDocument, PDFDict, PDFName, PDFString, PDFRawStream, StandardFonts, rgb, degrees, PDFFont, PDFPage } from "pdf-lib";
import { formatOrderNumber } from "@/lib/services/orders/orderFilters";

export interface WatermarkData {
  orderId: string;
  orderNumber: number;
  buyerName: string;
  buyerEmail: string;
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
 */
export async function applyWatermark(pdfBytes: Buffer, data: WatermarkData): Promise<Buffer> {
  // updateMetadata: false — by default pdf-lib stamps its own
  // Producer/Creator/ModDate at load time (and again on every later
  // load, including whatever tool a buyer or we open the result with),
  // which would silently clobber the identity fields this function's
  // entire job is to set. Metadata below is written explicitly instead.
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const orderLabel = formatOrderNumber(data.orderNumber);
  const tileText = `${data.buyerName} · Order ${orderLabel}`;
  const footerText = `Order ${orderLabel} · ${data.buyerEmail}`;

  for (const page of pdfDoc.getPages()) {
    drawTiledWatermark(page, font, tileText);
    drawFooter(page, font, footerText);
  }

  writeInfoMetadata(pdfDoc, data, orderLabel);
  writeXmpMetadata(pdfDoc, data, orderLabel);

  const outBytes = await pdfDoc.save();
  return Buffer.from(outBytes);
}

/**
 * Diagonal repeating tile at ~10% opacity, covering the full page
 * regardless of its size (each page is measured independently, so mixed
 * page sizes in one PDF are handled correctly). The loop deliberately
 * over-draws past all four edges — PDF viewers clip anything outside a
 * page's own MediaBox for free, so there's no need to compute the exact
 * rotated bounding box, just draw well past it.
 */
function drawTiledWatermark(page: PDFPage, font: PDFFont, text: string) {
  const { width, height } = page.getSize();
  const fontSize = 13;
  const angle = degrees(35);
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const stepX = textWidth + 70;
  const stepY = 85;
  const diag = Math.sqrt(width * width + height * height);

  for (let y = -diag; y < diag; y += stepY) {
    for (let x = -diag; x < diag; x += stepX) {
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.55, 0.55, 0.55),
        opacity: 0.1,
        rotate: angle,
      });
    }
  }
}

/** A persistent, higher-contrast strip at the bottom of every page — the part meant to be read, not just detected. */
function drawFooter(page: PDFPage, font: PDFFont, text: string) {
  const { width } = page.getSize();
  const fontSize = 8;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, {
    x: Math.max(18, (width - textWidth) / 2),
    y: 16,
    size: fontSize,
    font,
    color: rgb(0.3, 0.3, 0.3),
    opacity: 0.9,
  });
}

/**
 * pdf-lib's public API only covers the standard Info fields (Author,
 * Subject, Keywords, Producer, ...). Custom keys need the lower-level
 * context/trailer API — calling the public setters first guarantees the
 * Info dict exists (pdf-lib creates it lazily on first use), so the
 * lookup right after is always safe.
 */
function writeInfoMetadata(pdfDoc: PDFDocument, data: WatermarkData, orderLabel: string) {
  pdfDoc.setAuthor(data.buyerName);
  pdfDoc.setSubject(`Licensed to ${data.buyerName} <${data.buyerEmail}> — Order ${orderLabel}`);
  pdfDoc.setKeywords([`FrostEarth`, `Order ${orderLabel}`, data.buyerEmail, data.orderId]);
  pdfDoc.setProducer("FrostEarth");
  pdfDoc.setModificationDate(new Date());

  const infoRef = pdfDoc.context.trailerInfo.Info;
  const infoDict = infoRef ? pdfDoc.context.lookup(infoRef, PDFDict) : undefined;
  if (infoDict) {
    infoDict.set(PDFName.of("FrostEarthOrderID"), PDFString.of(data.orderId));
    infoDict.set(PDFName.of("FrostEarthBuyerEmail"), PDFString.of(data.buyerEmail));
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
  return [
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>`,
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">`,
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`,
    `<rdf:Description rdf:about=""`,
    `  xmlns:dc="http://purl.org/dc/elements/1.1/"`,
    `  xmlns:pdf="http://ns.adobe.com/pdf/1.3/"`,
    `  xmlns:frostearth="https://frostearth.in/ns/1.0/">`,
    `<dc:creator><rdf:Seq><rdf:li>${esc(data.buyerName)}</rdf:li></rdf:Seq></dc:creator>`,
    `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${esc(data.buyerEmail)}</rdf:li></rdf:Alt></dc:description>`,
    `<pdf:Keywords>${esc(`FrostEarth Order ${orderLabel}; ${data.buyerEmail}; ${data.orderId}`)}</pdf:Keywords>`,
    `<frostearth:orderId>${esc(data.orderId)}</frostearth:orderId>`,
    `<frostearth:orderNumber>${esc(orderLabel)}</frostearth:orderNumber>`,
    `<frostearth:buyerEmail>${esc(data.buyerEmail)}</frostearth:buyerEmail>`,
    `<frostearth:buyerName>${esc(data.buyerName)}</frostearth:buyerName>`,
    `</rdf:Description>`,
    `</rdf:RDF>`,
    `</x:xmpmeta>`,
    `<?xpacket end="w"?>`,
  ].join("\n");
}
