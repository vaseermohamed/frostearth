/**
 * A deliberately tiny, fully-auditable Markdown-to-HTML renderer — not a
 * general-purpose library. Content here is admin-authored legal text (see
 * PolicyService), but it's still rendered on a public page, so every
 * character of raw text is HTML-escaped before any markdown syntax is
 * substituted; the only HTML ever produced is the small fixed set of tags
 * this file emits itself. No dependency was added for this specifically so
 * the full set of producible output stays inspectable in one file instead
 * of behind a third-party parser's full feature surface (raw HTML passthrough,
 * script-bearing attributes, etc.) that isn't needed here.
 *
 * Supported syntax — exactly what the seeded legal pages use, nothing more:
 *   - `## Heading` (block) -> <h2>
 *   - blank-line-separated paragraphs -> <p>
 *   - `- item` lines (block, consecutive) -> <ul><li>
 *   - `**bold**` (inline) -> <strong>
 *   - `[text](url)` (inline) -> <a href="url">, url restricted to http(s)/
 *     mailto/relative paths — see isSafeUrl below.
 * Anything else (tables, nested lists, raw HTML, images, ...) is not
 * special-cased and renders as plain escaped text within its paragraph.
 */
export function renderPolicyMarkdown(markdown: string): string {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      html.push(`<h2>${renderInline(trimmed.slice(3).trim())}</h2>`);
      continue;
    }

    const lines = trimmed.split("\n").map((l) => l.trim());
    if (lines.every((l) => l.startsWith("- "))) {
      const items = lines.map((l) => `<li>${renderInline(l.slice(2).trim())}</li>`).join("");
      html.push(`<ul>${items}</ul>`);
      continue;
    }

    html.push(`<p>${renderInline(lines.join(" "))}</p>`);
  }

  return html.join("\n");
}

function renderInline(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) =>
      isSafeUrl(url) ? `<a href="${url}">${label}</a>` : label
    );
}

/** Blocks javascript:/data: etc. — only protocols a legal-document link legitimately needs. */
function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|\/)/i.test(url);
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
