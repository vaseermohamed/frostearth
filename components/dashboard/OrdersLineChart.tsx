"use client";

import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const FROST = "#2E5C8A";
// Tailwind's red-700 — the exact hex the Orders page's FAILED StatusBadge
// already renders with (text-red-700), so "failed" reads as the same
// color everywhere on the dashboard, not two different reds.
const FAILED_RED = "#B91C1C";
const FOG = "#E8E8E4";
const SLATE = "#6B6B68";

export interface DailyOrderCount {
  date: string;
  paid: number;
  failed: number;
}

/**
 * Chart.js's own legend is replaced with plain HTML chips above the
 * chart — easier to style consistently with the rest of the design
 * system than fighting Chart.js's legend plugin options.
 */
export default function OrdersLineChart({ data }: { data: DailyOrderCount[] }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FROST }} />
          <span className="text-slate">Paid</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FAILED_RED }} />
          <span className="text-slate">Failed</span>
        </span>
      </div>
      {/*
        Chart.js + `maintainAspectRatio: false` sizes the canvas off its
        PARENT's CSS box, not the `height` prop on <Line> (that only sets
        the canvas's intrinsic resolution attribute, not a layout
        constraint). Without an explicitly-heighted, position:relative
        wrapper here, the canvas has nothing bounded to measure against
        and the container grows unbounded — this div is the actual fix,
        not the options object.
      */}
      <div className="relative h-[300px]">
        <Line
          data={{
            labels: data.map((d) => d.date),
            datasets: [
              {
                label: "Paid",
                data: data.map((d) => d.paid),
                borderColor: FROST,
                backgroundColor: FROST,
                tension: 0.3,
                pointRadius: 2,
                borderWidth: 2,
              },
              {
                label: "Failed",
                data: data.map((d) => d.failed),
                borderColor: FAILED_RED,
                backgroundColor: FAILED_RED,
                tension: 0.3,
                pointRadius: 2,
                borderWidth: 2,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { mode: "index", intersect: false },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: SLATE, font: { size: 11 }, maxRotation: 0, autoSkip: true },
              },
              y: {
                beginAtZero: true,
                ticks: { precision: 0, color: SLATE, font: { size: 11 } },
                grid: { color: FOG },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
