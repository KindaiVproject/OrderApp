"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { formatJstDateKey, formatJstTime } from "@/lib/datetime";
import { timeToMinutes } from "@/lib/shifts";
import { dateLabel, roleColor, type ShiftItem } from "./shiftTypes";

const HOUR_PX = 72;
const LABEL_PX = 112;

type Bar = { role: string; start: number; end: number };
type Row = { memberId: string; name: string; image: string | null; isMe: boolean; unapproved: boolean; bars: Bar[] };

const minutesOfDay = (iso: string) => timeToMinutes(formatJstTime(new Date(iso)));
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// シフト表: one day at a time, a row per person and a time axis across, so
// who works when (and as what) reads at a glance. Scrolls sideways on phones.
export default function ShiftTable({ items }: { items: ShiftItem[] }) {
  const dates = [...new Set(items.map((i) => formatJstDateKey(new Date(i.shift.startsAt))))].sort();
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked && dates.includes(picked) ? picked : dates[0];

  if (!date) return <p className="text-sm text-neutral-400">表示できるシフトがありません</p>;

  const dayItems = items.filter((i) => formatJstDateKey(new Date(i.shift.startsAt)) === date);

  const rows = new Map<string, Row>();
  for (const { shift, assignments } of dayItems) {
    for (const a of assignments) {
      const row = rows.get(a.memberId) ?? {
        memberId: a.memberId,
        name: a.name,
        image: a.image,
        isMe: a.isMe,
        unapproved: a.unapproved,
        bars: [],
      };
      row.bars.push({ role: a.role, start: minutesOfDay(shift.startsAt), end: minutesOfDay(shift.endsAt) });
      rows.set(a.memberId, row);
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) => Math.min(...a.bars.map((x) => x.start)) - Math.min(...b.bars.map((x) => x.start)) || a.name.localeCompare(b.name),
  );

  const allBars = sorted.flatMap((r) => r.bars);
  // Shifts with nobody assigned still set the axis, so empty slots show.
  const starts = [...allBars.map((b) => b.start), ...dayItems.map((i) => minutesOfDay(i.shift.startsAt))];
  const ends = [...allBars.map((b) => b.end), ...dayItems.map((i) => minutesOfDay(i.shift.endsAt))];
  const axisStart = Math.floor(Math.min(...starts) / 60) * 60;
  const axisEnd = Math.max(axisStart + 60, Math.ceil(Math.max(...ends) / 60) * 60);
  const span = axisEnd - axisStart;
  const hours = span / 60;
  const trackWidth = hours * HOUR_PX;
  const hourMarks = Array.from({ length: hours }, (_, i) => axisStart + i * 60);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {dates.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setPicked(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              d === date ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-600"
            }`}
          >
            {dateLabel(d)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div style={{ minWidth: LABEL_PX + trackWidth }}>
          <div className="flex border-b border-neutral-200 text-[10px] text-neutral-500">
            <div className="sticky left-0 z-10 shrink-0 bg-white" style={{ width: LABEL_PX }} />
            <div className="relative h-6 flex-1">
              {hourMarks.map((m, i) => (
                <span
                  key={m}
                  className={`absolute top-1 tabular-nums ${i === 0 ? "pl-1" : "-translate-x-1/2"}`}
                  style={{ left: `${((m - axisStart) / span) * 100}%` }}
                >
                  {hhmm(m)}
                </span>
              ))}
            </div>
          </div>

          {sorted.map((row) => (
            <div key={row.memberId} className="flex border-b border-neutral-100 last:border-b-0">
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 bg-white px-2 py-1.5"
                style={{ width: LABEL_PX }}
              >
                <Avatar name={row.name} image={row.image} size={22} />
                <span className="min-w-0">
                  <span className={`block truncate text-xs ${row.isMe ? "font-bold text-neutral-900" : "text-neutral-700"}`}>
                    {row.name}
                  </span>
                  {row.unapproved && <span className="block text-[9px] font-bold text-amber-700">未承認ユーザー</span>}
                </span>
              </div>
              <div
                className="relative h-11 flex-1"
                style={{
                  backgroundImage: "linear-gradient(to right, #e5e5e5 1px, transparent 1px)",
                  backgroundSize: `${100 / hours}% 100%`,
                }}
              >
                {row.bars.map((bar, i) => (
                  <div
                    key={i}
                    title={`${bar.role} ${hhmm(bar.start)}〜${hhmm(bar.end)}`}
                    className={`absolute top-1 bottom-1 overflow-hidden rounded px-1.5 py-0.5 text-[11px] leading-tight ${roleColor(bar.role)} ${
                      row.isMe ? "ring-2 ring-blue-400" : ""
                    }`}
                    style={{
                      left: `${((bar.start - axisStart) / span) * 100}%`,
                      width: `${((bar.end - bar.start) / span) * 100}%`,
                    }}
                  >
                    <span className="block truncate font-semibold">{bar.role}</span>
                    <span className="block truncate tabular-nums opacity-70">
                      {hhmm(bar.start)}〜{hhmm(bar.end)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {sorted.length === 0 && <p className="p-3 text-xs text-neutral-400">この日は担当者が未設定です</p>}
        </div>
      </div>
    </div>
  );
}
