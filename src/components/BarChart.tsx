"use client";

import { useState } from "react";

// Sequential blue, palette step 450 — single-series magnitude, no legend needed.
const BAR_COLOR = "#2a78d6";

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}

export type BarDatum = {
  label: string;
  value: number;
  tooltipTitle: string;
};

export default function BarChart({
  data,
  height = 160,
  formatValue = (v: number) => `${v.toLocaleString("ja-JP")}円`,
}: {
  data: BarDatum[];
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  if (data.length === 0) {
    return <p className="text-sm text-neutral-400">データがありません</p>;
  }

  return (
    <div>
      <div className="flex" style={{ height }}>
        <div
          className="flex flex-col justify-between pr-2 text-right text-[10px] text-neutral-400"
          style={{ height }}
        >
          {[...ticks].reverse().map((t, i) => (
            <span key={i}>{t.toLocaleString("ja-JP")}</span>
          ))}
        </div>
        <div className="relative flex flex-1 items-end gap-[2px] border-l border-neutral-200">
          {ticks.map((t, i) => (
            <div
              key={i}
              className="pointer-events-none absolute left-0 right-0 border-t border-neutral-100"
              style={{ bottom: `${(t / max) * 100}%` }}
            />
          ))}
          {data.map((d, i) => (
            <div
              key={i}
              className="group relative flex flex-1 items-end justify-center"
              style={{ height }}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
            >
              <div
                className="w-full max-w-[22px] rounded-t-[4px] transition-opacity"
                style={{
                  height: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`,
                  backgroundColor: BAR_COLOR,
                  opacity: hovered === i ? 0.75 : 1,
                }}
              />
              {hovered === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-[10px] text-white shadow">
                  <div className="font-semibold">{formatValue(d.value)}</div>
                  <div className="text-neutral-300">{d.tooltipTitle}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-[2.5rem] mt-1 flex gap-[2px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-neutral-400">
            {data.length <= 24 || i % Math.ceil(data.length / 12) === 0 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
