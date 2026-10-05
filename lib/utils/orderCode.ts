import crypto from "crypto";

/**
 * Display-only obfuscation of Order.orderNumber (a sequential Postgres
 * autoincrement Int — see prisma/schema.prisma). The database, the
 * schema, and every internal query/relation still use the raw int
 * unchanged; this module only controls what a human ever sees. Its
 * entire purpose is that "FE-000047" directly reveals "this store has
 * had at least 47 orders" to anyone who receives a receipt, which a
 * random-looking code does not.
 *
 * This is a keyed, reversible PERMUTATION, not encryption in the
 * confidentiality sense — a 4-round Feistel network over a 40-bit
 * block (two 20-bit halves), with HMAC-SHA256(ORDER_CODE_SECRET, ...)
 * as the round function. A Feistel network is a bijection on its
 * block for ANY round function, so round-trip correctness doesn't
 * depend on HMAC-SHA256 being invertible — only on both sides running
 * the same rounds in the right order (see feistelEncrypt/Decrypt).
 * 40 bits was chosen because it's exactly 8 base32 characters (5 bits
 * each) with the alphabet below — no padding, no wasted bits.
 *
 * Pure functions, no database access — callers are responsible for
 * ever matching a decoded int back against a real order.
 */

/** No 0, 1, I, or O — all four are easy to confuse with 8, l/L, or each other when read off a screen or dictated over a phone call. 32 chars exactly: 5 bits/char. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const HALF_BITS = 20;
const HALF_SIZE = 1 << HALF_BITS; // 1,048,576 — safe as a plain bitwise shift, well under the 32-bit limit
const ROUNDS = 4;
const MAX_ORDER_NUMBER = 2 ** 40 - 1; // 8 base32 chars' worth of bits

function requireSecret(): string {
  const secret = process.env.ORDER_CODE_SECRET;
  if (!secret) throw new Error("ORDER_CODE_SECRET is not set");
  return secret;
}

/** HMAC-SHA256(secret, "<round>:<half>"), truncated to 20 bits via the low bits of the first 4 digest bytes. */
function roundFunction(secret: string, roundIndex: number, half: number): number {
  const digest = crypto.createHmac("sha256", secret).update(`${roundIndex}:${half}`).digest();
  return digest.readUInt32BE(0) & (HALF_SIZE - 1);
}

/**
 * The 40-bit value is split/combined with plain arithmetic (*, /, %),
 * never JS's bitwise operators — those coerce to 32-bit signed ints,
 * which silently corrupts anything at or above 2^31. Every value this
 * module actually bit-shifts (`half`, 20 bits) stays far under that
 * limit, so `^` on halves is safe; only the full 40-bit block isn't.
 */
function splitHalves(n: number): [number, number] {
  return [Math.floor(n / HALF_SIZE), n % HALF_SIZE];
}
function combineHalves(left: number, right: number): number {
  return left * HALF_SIZE + right;
}

function feistelEncrypt(n: number, secret: string): number {
  let [left, right] = splitHalves(n);
  for (let round = 0; round < ROUNDS; round++) {
    const nextLeft = right;
    const nextRight = left ^ roundFunction(secret, round, right);
    left = nextLeft;
    right = nextRight;
  }
  return combineHalves(left, right);
}

function feistelDecrypt(n: number, secret: string): number {
  let [left, right] = splitHalves(n);
  for (let round = ROUNDS - 1; round >= 0; round--) {
    const prevRight = left;
    const prevLeft = right ^ roundFunction(secret, round, left);
    left = prevLeft;
    right = prevRight;
  }
  return combineHalves(left, right);
}

function toBase32(n: number): string {
  const chars: string[] = [];
  let remaining = n;
  for (let i = 0; i < 8; i++) {
    chars.unshift(ALPHABET[remaining % 32]);
    remaining = Math.floor(remaining / 32);
  }
  return chars.join("");
}

/** null if any character isn't in the alphabet. */
function fromBase32(code: string): number | null {
  let n = 0;
  for (const ch of code) {
    const index = ALPHABET.indexOf(ch);
    if (index === -1) return null;
    n = n * 32 + index;
  }
  return n;
}

/** "FE-XXXX-XXXX". Throws if n is out of range or ORDER_CODE_SECRET is unset — never silently returns a wrong/default code. */
export function encodeOrderCode(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > MAX_ORDER_NUMBER) {
    throw new Error(`encodeOrderCode: order number must be an integer in [1, ${MAX_ORDER_NUMBER}]; got ${n}`);
  }
  const secret = requireSecret();
  const code = toBase32(feistelEncrypt(n, secret));
  return `FE-${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

/**
 * Accepts the current code format, the old "FE-000047"/plain-digit
 * format (so existing receipts/links/dashboard searches typed from
 * memory keep working), case-insensitively and with spaces/hyphens
 * removed. Returns null for anything that isn't one of those —
 * including a well-formed-looking but wrong 8-character code, since
 * Feistel decode always produces SOME integer and this function has
 * no way to know whether that integer is a real order id; callers
 * must still verify against the database.
 *
 * The 8-character alphabet/Feistel check runs BEFORE the legacy
 * all-digits check (see the comment on that branch below) — an 8-char
 * code made entirely of digits 2-9 is valid alphabet input and must be
 * Feistel-decoded, not misread as a literal base-10 number.
 *
 * Only throws if an 8-character alphabet code is given and
 * ORDER_CODE_SECRET is unset — a plain-digit legacy search never
 * needs the secret at all, so it must keep working even then; silently
 * returning null in that specific case would masquerade a real
 * misconfiguration as "no such order."
 */
export function decodeOrderCode(input: string): number | null {
  if (typeof input !== "string") return null;

  let normalized = input.trim().toUpperCase().replace(/[\s-]/g, "");
  if (normalized.startsWith("FE")) normalized = normalized.slice(2);
  if (normalized.length === 0) return null;

  // Checked BEFORE the legacy all-digits branch below, deliberately.
  // Digits 2-9 are literally the alphabet's first 8 characters (see
  // ALPHABET above), so a genuine encoded code can land entirely on
  // digits — e.g. "23456789" is a valid 8-char alphabet string AND
  // matches /^[0-9]+$/. If the legacy branch ran first, that code would
  // get misread as the literal integer 23,456,789 instead of
  // Feistel-decoded. Once an 8-character string is confirmed to be
  // valid alphabet characters, it's committed to this path — win or
  // lose on the range check below — never falls through to legacy,
  // because by construction nothing that's a genuine 8-char alphabet
  // string should ever be reinterpreted as a bare decimal number.
  // Anything with so much as one invalid character (a literal "0" or
  // "1", which aren't in the alphabet at all, or any other symbol)
  // fails fromBase32 and falls through — e.g. "00000047" (has zeros)
  // correctly reaches the legacy branch below as the old padded format.
  if (normalized.length === 8) {
    const encrypted = fromBase32(normalized);
    if (encrypted !== null) {
      const secret = requireSecret();
      const n = feistelDecrypt(encrypted, secret);
      return n >= 1 && n <= MAX_ORDER_NUMBER ? n : null;
    }
  }

  if (/^[0-9]+$/.test(normalized)) {
    const n = parseInt(normalized, 10);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
  }

  return null;
}
