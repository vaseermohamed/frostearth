/**
 * Splits text into runs by Unicode script block, so a string mixing
 * scripts (e.g. an English word followed by a Tamil word) can be
 * rendered with a different font per run instead of one font for the
 * whole string — no pdf-lib/font dependency here, pure Unicode logic,
 * kept separate so it's easy to unit-test and easy to extend with more
 * script ranges later.
 */

export type ScriptId = "latin" | "tamil" | "devanagari";

/**
 * Only the scripts we currently embed a font for get their own bucket.
 * Everything else — including scripts we haven't added yet (Bengali,
 * Telugu, Kannada, ...) — falls into "latin" by default and is handled
 * by whatever font the caller maps "latin" to. That's a deliberate,
 * documented gap (see PdfWatermarkService.ts), not an attempt to cover
 * every script silently.
 */
const SCRIPT_RANGES: { id: ScriptId; start: number; end: number }[] = [
  { id: "devanagari", start: 0x0900, end: 0x097f },
  { id: "tamil", start: 0x0b80, end: 0x0bff },
];

function scriptForCodePoint(codePoint: number): ScriptId {
  for (const range of SCRIPT_RANGES) {
    if (codePoint >= range.start && codePoint <= range.end) return range.id;
  }
  return "latin";
}

export interface ScriptRun {
  script: ScriptId;
  text: string;
}

/**
 * Iterates by Unicode code point (via `for...of` on a string, not index
 * access) so a surrogate pair — anything outside the Basic Multilingual
 * Plane, e.g. some emoji — is never split across two runs.
 */
export function splitIntoScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  let current: ScriptRun | null = null;

  for (const char of text) {
    const codePoint = char.codePointAt(0)!;
    const script = scriptForCodePoint(codePoint);
    if (current && current.script === script) {
      current.text += char;
    } else {
      current = { script, text: char };
      runs.push(current);
    }
  }

  return runs;
}
