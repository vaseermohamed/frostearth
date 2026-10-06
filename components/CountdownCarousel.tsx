"use client";

import { useEffect, useState } from "react";

export interface CountdownItem {
  id: string;
  examName: string;
  label: string;
  targetTime: number; // epoch ms — Date objects don't cross the server/client boundary as component props, so the server page passes this instead
}

const ROTATE_MS = 15000;

function remainingParts(targetTime: number, now: number) {
  const diffMs = Math.max(0, targetTime - now);
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

/**
 * Server renders the initial state (see the "now" prop, captured once at
 * request time on app/c/[slug]/page.tsx), then this ticks forward
 * client-side every minute — no polling, no server round-trip, just
 * local arithmetic against each item's fixed targetTime.
 */
export default function CountdownCarousel({ items, now }: { items: CountdownItem[]; now: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [clock, setClock] = useState(now);

  useEffect(() => {
    const tick = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const rotate = setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => clearInterval(rotate);
  }, [items.length]);

  if (items.length === 0) return null;

  const active = items[activeIndex % items.length];
  const { days, hours, minutes } = remainingParts(active.targetTime, clock);

  return (
    <section className="bg-ink">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 text-center">
        <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-fog/60">
            {active.examName}
          </span>
          <span className="text-fog/40">·</span>
          <span className="text-xs sm:text-sm text-fog/80">{active.label}</span>
          <span className="text-fog/40">·</span>
          <span className="font-mono text-lg sm:text-2xl font-bold text-paper tabular-nums">
            {days}d {hours}h {minutes}m
          </span>
        </div>

        {items.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show ${item.examName} countdown`}
                onClick={() => setActiveIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeIndex ? "bg-frost" : "bg-fog/30"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
