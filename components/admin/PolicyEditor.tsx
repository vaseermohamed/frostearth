"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PolicyVersionDTO {
  id: string;
  version: number | null;
  title: string;
  content: string;
  status: "DRAFT" | "PUBLISHED";
  effectiveAt: string | null;
  contentHash: string | null;
}

interface Props {
  storeId: string;
  policyType: "TERMS" | "PRIVACY" | "REFUND_POLICY";
  label: string;
  published: PolicyVersionDTO | null;
  draft: PolicyVersionDTO | null;
  history: PolicyVersionDTO[];
}

/**
 * One policy type's whole admin UI: current published state + history +
 * the edit/publish flow. "Edit" either reopens the existing draft row
 * (no API call needed — see handleEdit) or creates one immediately via
 * PUT /draft (matches the spec's "Edit creates/reopens a DRAFT row"
 * literally — the row exists the moment you click Edit, not only once
 * you later click Save). "Publish" saves whatever is currently in the
 * textarea first, then locks it — so publishing always matches exactly
 * what's on screen, never a stale previously-saved draft.
 */
export default function PolicyEditor({ storeId, policyType, label, published, draft, history }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(draft?.title ?? published?.title ?? label);
  const [content, setContent] = useState(draft?.content ?? published?.content ?? "");
  const [busy, setBusy] = useState<"idle" | "saving" | "publishing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function handleEdit() {
    setError(null);
    if (draft) {
      setTitle(draft.title);
      setContent(draft.content);
      setEditing(true);
      return;
    }

    setBusy("saving");
    const res = await fetch("/api/admin/legal/policy/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        policyType,
        title: published?.title ?? label,
        content: published?.content ?? "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("idle");

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create draft");
      return;
    }
    setTitle(data.draft.title);
    setContent(data.draft.content);
    setEditing(true);
    router.refresh();
  }

  async function saveDraft(): Promise<boolean> {
    setError(null);
    setBusy("saving");
    const res = await fetch("/api/admin/legal/policy/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, policyType, title, content }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("idle");

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save draft");
      return false;
    }
    return true;
  }

  async function handleSave() {
    const ok = await saveDraft();
    if (ok) router.refresh();
  }

  async function handlePublish() {
    const saved = await saveDraft();
    if (!saved) return;

    setError(null);
    setBusy("publishing");
    const res = await fetch("/api/admin/legal/policy/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, policyType }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("idle");

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not publish");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-fog p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-lg text-ink">{label}</h2>
          {published ? (
            <p className="text-xs text-slate mt-0.5">
              Currently published: v{published.version} · effective {formatDate(published.effectiveAt)} · hash{" "}
              <span className="font-mono">{published.contentHash?.slice(0, 12)}…</span>
            </p>
          ) : (
            <p className="text-xs text-amber-700 mt-0.5">No published version yet — the public page will show a &quot;not available&quot; message.</p>
          )}
          {draft && !editing && <p className="text-xs text-frost mt-0.5">A draft is waiting — click Edit to continue it.</p>}
        </div>
        {!editing && (
          <button
            onClick={handleEdit}
            disabled={busy !== "idle"}
            className="shrink-0 rounded-full border border-fog px-4 py-1.5 text-xs font-medium text-ink hover:border-ink transition-colors disabled:opacity-60"
          >
            Edit
          </button>
        )}
      </div>

      {editing && (
        <div className="space-y-3 border-t border-fog pt-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-fog px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-frost"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder="Markdown content — ## headings, blank-line paragraphs, - list items, **bold**, [text](url) links"
            className="w-full rounded-lg border border-fog px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-frost"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={busy !== "idle"}
              className="rounded-full border border-fog px-4 py-2 text-xs font-medium text-ink hover:border-ink transition-colors disabled:opacity-60"
            >
              {busy === "saving" ? "Saving…" : "Save draft"}
            </button>
            <button
              onClick={handlePublish}
              disabled={busy !== "idle"}
              className="rounded-full bg-frost hover:opacity-90 transition-opacity text-white text-xs font-medium px-4 py-2 disabled:opacity-60"
            >
              {busy === "publishing" ? "Publishing…" : `Publish as v${(published?.version ?? 0) + 1}`}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={busy !== "idle"}
              className="text-xs text-slate hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editing && published && (
        <p className="text-sm text-slate whitespace-pre-line line-clamp-3 border-t border-fog pt-3">
          {published.content.slice(0, 280)}
          {published.content.length > 280 ? "…" : ""}
        </p>
      )}

      {history.length > 0 && (
        <div className="border-t border-fog pt-3">
          <button onClick={() => setHistoryOpen((v) => !v)} className="text-xs text-slate hover:text-ink transition-colors">
            {historyOpen ? "Hide" : "Show"} version history ({history.length})
          </button>
          {historyOpen && (
            <div className="mt-2 divide-y divide-fog">
              {history.map((h) => (
                <div key={h.id} className="py-2 text-xs text-slate flex items-center justify-between gap-3">
                  <span>v{h.version} · {formatDate(h.effectiveAt)}</span>
                  <span className="font-mono">{h.contentHash?.slice(0, 12)}…</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
