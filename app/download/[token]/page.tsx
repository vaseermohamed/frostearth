"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Stage = "loading" | "success" | "error";

// How long the fill takes to ease toward PROGRESS_CEILING — a real
// generation typically takes 5-6s (reported from a mobile test), so this
// is tuned to roughly track that without ever claiming false precision
// about the exact moment it'll finish. If the real fetch resolves first,
// the bar snaps to 100% immediately (see the transitionMs override
// below) rather than waiting out this duration. If the fetch takes
// longer, the bar simply sits at the ceiling — it never claims 100%
// before the file is actually ready.
const PROGRESS_ANIMATION_MS = 5500;
const PROGRESS_CEILING = 88;
const SNAP_TRANSITION_MS = 200;

export default function DownloadInterstitialPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [stage, setStage] = useState<Stage>("loading");
  const [progress, setProgress] = useState(0);
  const [transitionMs, setTransitionMs] = useState(PROGRESS_ANIMATION_MS);
  const [errorMessage, setErrorMessage] = useState("");

  const blobUrlRef = useRef<string | null>(null);
  const fileNameRef = useRef<string>("download.pdf");

  useEffect(() => {
    let cancelled = false;

    // Kick the fill toward the ceiling on the next frame, not this one —
    // setting it in the same tick as the initial 0% render would collapse
    // the transition (the browser would never paint the starting state).
    const raf = requestAnimationFrame(() => {
      if (!cancelled) setProgress(PROGRESS_CEILING);
    });

    fetch(`/api/download/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data.error === "string" ? data.error : "This download link isn't valid.");
        }
        const disposition = res.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="([^"]+)"/);
        if (match) fileNameRef.current = match[1];
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        // Snap immediately — don't let a fast response wait out the slow
        // eased animation, and don't let a slow response stay capped
        // below 100% once the file is actually in hand.
        setTransitionMs(SNAP_TRANSITION_MS);
        setProgress(100);
        triggerSave(url, fileNameRef.current);
        setStage("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setTransitionMs(SNAP_TRANSITION_MS);
        const message =
          err instanceof Error && err.message && err.message !== "Failed to fetch"
            ? err.message
            : "We couldn't reach the server. Check your connection and try refreshing.";
        setErrorMessage(message);
        setStage("error");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Blob URL stays alive for "Download again" to reuse without a second
  // network request — only released when the page itself goes away.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  function triggerSave(url: string, fileName: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleDownloadAgain() {
    if (blobUrlRef.current) triggerSave(blobUrlRef.current, fileNameRef.current);
  }

  if (stage === "error") {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white rounded-2xl border border-red-200 p-6">
          <p className="font-display font-extrabold text-lg text-red-700 mb-1">Couldn't prepare your download</p>
          <p className="text-sm text-slate mb-4">{errorMessage}</p>
          <p className="text-sm text-slate">
            If this doesn't seem right,{" "}
            <a href="mailto:hello@frostearth.in" className="text-ink underline">
              contact us
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-[52px] h-[52px] rounded-full bg-frost flex items-center justify-center">
            <CheckIcon />
          </div>
        </div>
        <p className="text-[15px] font-medium text-ink mb-6">Download started</p>
        <button
          onClick={handleDownloadAgain}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-ink hover:bg-ink/85 transition-colors text-white text-sm font-medium px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-frost focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <DownloadIcon />
          Download again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16 sm:py-24 text-center">
      <div className="flex justify-center mb-5">
        <div className="w-[52px] h-[52px] rounded-xl bg-fog flex items-center justify-center text-slate">
          <FileIcon />
        </div>
      </div>
      <p className="text-[15px] font-medium text-ink mb-1">Preparing your download</p>
      <p className="text-[13px] text-slate mb-6">This usually takes a few seconds</p>
      <div className="h-1.5 w-full rounded-full bg-fog overflow-hidden">
        <div
          data-testid="progress-fill"
          className="h-full rounded-full bg-frost"
          style={{ width: `${progress}%`, transition: `width ${transitionMs}ms ease-out` }}
        />
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
