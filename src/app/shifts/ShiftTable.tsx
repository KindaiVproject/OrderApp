"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { formatJstDateKey, formatJstTime } from "@/lib/datetime";
import { timeToMinutes } from "@/lib/shifts";
import { dateLabel, roleColor, type ShiftItem } from "./shiftTypes";

const HOUR_PX = 72;
const LABEL_PX = 112;
const LANE_PX = 44;

type Bar = {
  title: string;
  text: string;
  start: number;
  end: number;
  color: string;
  mine: boolean;
};
type Row = {
  key: string;
  // Sort key: earliest start, then label text.
  sortText: string;
  label: React.ReactNode;
  bars: Bar[];
};
type Mode = "role" | "person";

const minutesOfDay = (iso: string) => timeToMinutes(formatJstTime(new Date(iso)));
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Greedy lane packing: bars that overlap in time go on separate lanes, so
// several people on the same role at the same hour stack instead of hiding
// each other.
function assignLanes(bars: Bar[]) {
  const sorted = [...bars].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const placed = sorted.map((bar) => {
    let lane = laneEnds.findIndex((end) => end <= bar.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = bar.end;
    return { bar, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

// シフト表: one day at a time with a time axis across. Rows are roles by
// default (who covers 調理 / レジ when), or people (what each person does
// when). Scrolls sideways on phones.
export default function ShiftTable({ items, roleOrder }: { items: ShiftItem[]; roleOrder: string[] }) {
  const dates = [...new Set(items.map((i) => formatJstDateKey(new Date(i.shift.startsAt))))].sort();
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("role");
  const date = picked && dates.includes(picked) ? picked : dates[0];

  if (!date) return <p className="text-sm text-neutral-400">表示できるシフトがありません</p>;

  const dayItems = items.filter((i) => formatJstDateKey(new Date(i.shift.startsAt)) === date);

  const rowMap = new Map<string, Row>();
  for (const { shift, assignments } of dayItems) {
    const start = minutesOfDay(shift.startsAt);
    const end = minutesOfDay(shift.endsAt);
    for (const a of assignments) {
      const range = `${hhmm(start)}〜${hhmm(end)}`;
      const key = mode === "role" ? a.role : a.memberId;
      let row = rowMap.get(key);
      if (!row) {
        row =
          mode === "role"
            ? {
                key,
                sortText: a.role,
                label: (
                  <span className={`truncate rounded px-1.5 py-0.5 text-xs font-semibold ${roleColor(a.role)}`}>
                    {a.role}
                  </span>
                ),
                bars: [],
              }
            : {
                key,
                sortText: a.name,
                label: (
                  <>
                    <Avatar name={a.name} image={a.image} size={22} />
                    <span className="min-w-0">
                      <span className={`block truncate text-xs ${a.isMe ? "font-bold text-neutral-900" : "text-neutral-700"}`}>
                        {a.name}
                      </span>
                      {a.unapproved && <span className="block text-[9px] font-bold text-amber-700">未承認ユーザー</span>}
                    </span>
                  </>
                ),
                bars: [],
              };
        rowMap.set(key, row);
      }
      row.bars.push({
        title: `${a.name}${a.unapproved ? "(未承認ユーザー)" : ""} ${a.role} ${range}`,
        text: mode === "role" ? a.name : a.role,
        start,
        end,
        color: roleColor(a.role),
        mine: a.isMe,
      });
    }
  }

  const earliest = (r: Row) => Math.min(...r.bars.map((b) => b.start));
  const roleRank = (name: string) => {
    const i = roleOrder.indexOf(name);
    return i === -1 ? roleOrder.length : i;
  };
  const rows = [...rowMap.values()].sort((a, b) =>
    mode === "role"
      ? roleRank(a.sortText) - roleRank(b.sortText) || a.sortText.localeCompare(b.sortText)
      : earliest(a) - earliest(b) || a.sortText.localeCompare(b.sortText),
  );

  const allBars = rows.flatMap((r) => r.bars);
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded border border-neutral-300 text-xs font-medium">
          {(["role", "person"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 ${mode === m ? "bg-neutral-900 text-white" : "bg-white text-neutral-600"}`}
            >
              {m === "role" ? "役割ごと" : "人ごと"}
            </button>
          ))}
        </div>
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

          {rows.map((row) => {
            const { placed, lanes } = assignLanes(row.bars);
            return (
              <div key={row.key} className="flex border-b border-neutral-100 last:border-b-0">
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 bg-white px-2 py-1.5"
                  style={{ width: LABEL_PX }}
                >
                  {row.label}
                </div>
                <div
                  className="relative flex-1"
                  style={{
                    height: lanes * LANE_PX,
                    backgroundImage: "linear-gradient(to right, #e5e5e5 1px, transparent 1px)",
                    backgroundSize: `${100 / hours}% 100%`,
                  }}
                >
                  {placed.map(({ bar, lane }, i) => (
                    <div
                      key={i}
                      title={bar.title}
                      className={`absolute overflow-hidden rounded px-1.5 py-0.5 text-[11px] leading-tight ${bar.color} ${
                        bar.mine ? "ring-2 ring-blue-400" : ""
                      }`}
                      style={{
                        top: lane * LANE_PX + 4,
                        height: LANE_PX - 8,
                        left: `${((bar.start - axisStart) / span) * 100}%`,
                        width: `${((bar.end - bar.start) / span) * 100}%`,
                      }}
                    >
                      <span className="block truncate font-semibold">{bar.text}</span>
                      <span className="block truncate tabular-nums opacity-70">
                        {hhmm(bar.start)}〜{hhmm(bar.end)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <p className="p-3 text-xs text-neutral-400">この日は担当者が未設定です</p>}
        </div>
      </div>
    </div>
  );
}
