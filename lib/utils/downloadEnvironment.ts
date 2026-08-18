/**
 * Classifies the current browser environment for the download page
 * (app/download/[token]/page.tsx) into the three buckets that need
 * genuinely different download mechanisms:
 *
 *   - "in-app-browser": a restricted in-app WebView (named, e.g.
 *     Instagram/WhatsApp, OR an unrecognized one caught by the generic
 *     heuristics below) — no client-side download technique is reliable
 *     here. The only fix is leaving the app for a real browser.
 *   - "ios": Safari, CriOS (Chrome-iOS), FxiOS (Firefox-iOS), or any
 *     other iOS UA that didn't match an in-app pattern — all WebKit
 *     under the hood, sharing Safari's blob: URL limitations (including
 *     blob navigation crashing with a WebKitBlobResource error in some
 *     versions). Skip blob+fetch entirely; use a plain top-level
 *     <a href> to the API route instead.
 *   - "standard": everything else (desktop, Android Chrome/Firefox/
 *     Samsung Internet, Edge desktop) — the existing blob+fetch
 *     mechanism, confirmed working via live testing.
 *
 * Matching order matters and is NOT arbitrary:
 *   1. Named in-app browser patterns (most confident — a real, cited
 *      token)
 *   2. Generic Android WebView token ("; wv)")
 *   3. Generic iOS in-app-browser heuristic (lower confidence — see
 *      below)
 *   4. Broad iOS device match (Safari/CriOS/FxiOS and anything that
 *      passed step 3 without matching)
 *   5. Standard
 * The generic iOS check MUST run before the broad iOS bucket: an
 * unrecognized iOS in-app WebView could be just as restricted as
 * Instagram's, and routing it to "ios" (plain-link mechanism) on the
 * unverified assumption that it'll work would repeat the exact class of
 * bug this file exists to prevent.
 *
 * Client-only by nature (reads navigator.userAgent) — always returns
 * "standard" during SSR/when navigator isn't available, so callers must
 * treat that as "not yet determined" rather than a real answer and defer
 * anything consequential (like firing the download fetch) until after a
 * client-side check. See the page component for that gating.
 */

export type DownloadEnvironment = "in-app-browser" | "ios" | "standard";

/**
 * ── Named in-app/WebView browser UA signatures ──────────────────────
 *
 * Every pattern below cites the real source it was verified against
 * (a live UA-database entry, a platform vendor's own blog post, or a
 * primary GitHub issue) as of 2026-08-19 — see the accompanying
 * investigation report for full citations. Confidence is documented per
 * platform because several of these apps behave very differently on iOS
 * vs Android (some use a raw WebView with a custom UA token; others use
 * a system browser sheet — SFSafariViewController on iOS, Custom Tabs
 * on Android — which typically CANNOT carry a custom token at all).
 *
 * Treat this list as a living document: when a new in-app browser is
 * reported, add one entry — nothing else needs to change.
 */
interface NamedPattern {
  name: string;
  pattern: RegExp;
  /** Free-text confidence note per platform, kept close to the pattern it describes rather than in a separate doc that will drift. */
  confidence: string;
}

const IN_APP_BROWSER_PATTERNS: NamedPattern[] = [
  {
    name: "Instagram",
    pattern: /Instagram/i,
    confidence:
      "HIGH both platforms — real UA samples confirmed for iOS (Instagram 93.x era) and Android (Instagram 309.x, 2024). Instagram uses a raw WebView with an appended literal \"Instagram\" token on both OSes.",
  },
  {
    name: "Facebook",
    pattern: /FBAN|FBAV/i,
    confidence:
      "HIGH both platforms — FBAN (Facebook App Name) / FBAV (Facebook App Version) tokens confirmed via real UA samples on both iOS (FBAN/FBIOS) and Android (FBAN/FB4A, 2024 sample). Messenger shares the same Meta SDK tokens.",
  },
  {
    name: "WhatsApp",
    pattern: /WhatsApp/i,
    confidence:
      "MEDIUM Android / LOW-UNCONFIRMED iOS. Every \"WhatsApp/x.x.x ...\" sample found matches WhatsApp's own internal API/networking traffic format, not a confirmed capture of what a real webpage sees when a human taps a link inside WhatsApp's actual in-app browser. Evidence suggests WhatsApp's in-app browser (\"IAB\") only fires for links in Business-API template/CTA messages — regular chat-message links reportedly open in the phone's default browser instead, meaning the common case may never hit this pattern at all. On iOS specifically, if WhatsApp uses an SFSafariViewController-style system browser sheet (as many major apps do), no custom UA token is even possible to inject — Apple's API doesn't allow it. Pattern kept as a defensive no-cost catch-all in case a token does appear in some version/context, but NOT to be treated as confirmed-reliable the way Instagram/Facebook are. See open items in the report.",
  },
  {
    name: "Telegram",
    pattern: /Telegram/i,
    confidence:
      "HIGH Android / CONFIRMED-ABSENT iOS. Android: real 2025 UA sample cites a literal \"Telegram-Android/11.9.0\" token (user-agents.net). iOS: Telegram's own GitHub issue tracker (TelegramMessenger/Telegram-iOS #736, filed 2022, still open with no fix as of this check) confirms the in-app browser's UA is IDENTICAL to real Safari — there is currently no way to name-detect Telegram on iOS. It will fall through to the broad \"ios\" bucket instead (which is the safe-ish default, but genuinely unverified for Telegram's specific WebView — see open items).",
  },
  {
    name: "Twitter/X",
    pattern: /Twitter/i,
    confidence:
      "MEDIUM-HIGH iOS / UNCONFIRMED Android. Real iOS samples through 2024-2025 still show the literal \"Twitter for iPhone/12.x\" token despite the X rebrand — format hasn't changed. No independently-cited Android sample found this session; kept on the (unverified) assumption the Android app uses a parallel \"Twitter for Android\" token. Lower priority per this task — not a confirmed FrostEarth traffic source.",
  },
  {
    name: "LinkedIn",
    pattern: /LinkedInApp/i,
    confidence:
      "MEDIUM iOS / UNCONFIRMED Android. Real iOS sample confirms a \"[LinkedInApp]/9.30.1317\" token. No independently-cited Android sample found this session. Lower priority per this task — not a confirmed FrostEarth traffic source.",
  },
  {
    name: "Gmail",
    pattern: /\bGmail\b/i,
    confidence:
      "UNCONFIRMED / LIKELY UNRELIABLE, documented as a known limitation rather than a working detection. No real UA sample citing an identifiable Gmail-specific token was found. A first-hand practitioner discussion (Adobe Experience League community) explicitly concludes Gmail's detectability is unconfirmed — the responder states they are \"not sure\" whether Gmail appends anything at all. Architecturally, Gmail's Android link-opening browser is most often a Custom Tab, which (like WhatsApp's likely iOS behavior) typically renders the surrounding browser's own UA unmodified, with no app-specific token possible. This pattern is kept only as a best-effort, zero-cost fallback — do not treat a Gmail miss as a bug; it is very plausibly undetectable via UA on current Android versions, full stop.",
  },
  {
    name: "TikTok",
    pattern: /TikTok|musical_ly|BytedanceWebview/i,
    confidence:
      "UNVERIFIED this session (no new research performed — carried over from the prior pass, which sourced this from community in-app-browser-detection heuristics, not a cited live sample). Lower priority per this task — not a confirmed FrostEarth traffic source.",
  },
];

/**
 * ── Generic fallback for unnamed in-app browsers ────────────────────
 * Everything not in the named list above (Snapchat, Pinterest, Discord,
 * Reddit, unlisted future apps, etc.) — a best-effort heuristic rather
 * than a confirmed token, since by definition nothing distinctive is
 * being matched.
 */

/**
 * Android: the standard WebView UA carries a literal "; wv)" token
 * (present unless the hosting app explicitly overrides its UA to hide
 * it). Confirmed against Google's own Android Developers Blog (Dec
 * 2024, "User-Agent Reduction on Android WebView") and multiple
 * real captured samples (Instagram's own Android WebView UA, e.g.,
 * also carries this same "; wv)" token underneath its "Instagram"
 * suffix — consistent evidence across sources). HIGH confidence.
 */
const ANDROID_GENERIC_WEBVIEW_PATTERN = /;\s?wv\)/i;

const IOS_DEVICE_PATTERN = /iPhone|iPad|iPod/i;
const IOS_SAFARI_VERSION_TOKEN = /Version\/[\d.]+/i;
const IOS_CHROME_PATTERN = /CriOS/i;
const IOS_FIREFOX_PATTERN = /FxiOS/i;

/**
 * iOS: real Safari always carries a "Version/X.Y" token; CriOS/FxiOS
 * identify themselves explicitly. A UA that reports an iPhone/iPad/iPod
 * device but has NONE of those three signals is most likely a raw
 * WKWebView presented by some app that didn't bother customizing its
 * UA at all (or stripped the giveaway tokens) — plausibly just as
 * download-restricted as Instagram's. LOWER CONFIDENCE than the
 * Android "wv" check: unlike Android, there's no single official/
 * documented token Apple mandates for "this is an embedded WebView,"
 * so this is inference from absence of the real-browser signals, not a
 * positive, cited match. False positives are plausible for any
 * legitimate niche iOS browser this heuristic hasn't been checked
 * against.
 */
function isGenericIOSInAppBrowser(ua: string): boolean {
  if (!IOS_DEVICE_PATTERN.test(ua)) return false;
  if (IOS_CHROME_PATTERN.test(ua) || IOS_FIREFOX_PATTERN.test(ua)) return false;
  return !IOS_SAFARI_VERSION_TOKEN.test(ua);
}

/**
 * iPadOS 13+ Safari reports a plain "Macintosh" UA by default (no
 * "iPad" substring at all, indistinguishable from a real Mac by UA
 * string alone). The standard workaround: real Macs never report
 * multi-touch support, so a touch-capable "MacIntel" platform is
 * iPadOS in desktop mode.
 */
function isLikelyIPadDesktopMode(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** The matched in-app browser's display name, or null if none matched (including a generic-only match — the UI shows an unbranded message in that case). */
export function detectInAppBrowserName(userAgent?: string): string | null {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return IN_APP_BROWSER_PATTERNS.find(({ pattern }) => pattern.test(ua))?.name ?? null;
}

export function detectDownloadEnvironment(userAgent?: string): DownloadEnvironment {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");

  if (IN_APP_BROWSER_PATTERNS.some(({ pattern }) => pattern.test(ua))) {
    return "in-app-browser";
  }
  if (ANDROID_GENERIC_WEBVIEW_PATTERN.test(ua)) {
    return "in-app-browser";
  }
  if (isGenericIOSInAppBrowser(ua)) {
    return "in-app-browser";
  }
  if (IOS_DEVICE_PATTERN.test(ua) || isLikelyIPadDesktopMode()) {
    return "ios";
  }
  return "standard";
}
