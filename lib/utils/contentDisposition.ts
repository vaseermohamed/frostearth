/**
 * Builds an `attachment` Content-Disposition header that survives any
 * file name. HTTP header values must be Latin-1 bytes — a raw Tamil or
 * Devanagari name makes `new Headers()` throw, which used to turn a paid
 * download into an error. So the header carries two names (RFC 6266):
 *   - filename=   ASCII-only fallback, for old clients
 *   - filename*=  the real name, UTF-8 percent-encoded (RFC 5987),
 *                 which every current browser prefers when present
 */
export function attachmentContentDisposition(fileName: string): string {
  const name = fileName.replace(/[\r\n]/g, "").trim() || "download";
  return `attachment; filename="${asciiFallback(name)}"; filename*=UTF-8''${encodeRfc5987(name)}`;
}

function asciiFallback(name: string): string {
  const extMatch = name.match(/\.[A-Za-z0-9]{1,8}$/);
  const ext = extMatch ? extMatch[0] : "";
  const base = name
    .slice(0, name.length - ext.length)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\]/g, "")
    .trim();
  return (base || "download") + ext;
}

function encodeRfc5987(value: string): string {
  // encodeURIComponent leaves ' ( ) * ! unescaped; RFC 5987 attr-char doesn't allow them.
  return encodeURIComponent(value).replace(/['()*!]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
