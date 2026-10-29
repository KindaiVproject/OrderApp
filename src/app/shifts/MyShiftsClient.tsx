"use client";

import Link from "next/link";
import { useState } from "react";
import { formatJstDateKey, formatJstTime } from "@/lib/datetime";
import { shiftColor } from "@/lib/shiftColors";
import CalendarExportCard from "./CalendarExportCard";
import { dateLabel } from "./shiftTypes";

export type MyShift = {
  id: string;
  shiftId: string;
  // Already put into the calendar (an .ics download) and unchanged since.
  calendarAdded: boolean;
  instanceId: string;
  instanceName: string;
  instanceLabel: string;
  instanceActive: boolean;
  startsAt: string;
  endsAt: string;
  role: string;
  // Palette key chosen for the role in its instance (null = automatic).
  roleColor: string | null;
};

// My shifts across every instance I can open, in time order.
export default function MyShiftsClient({ shifts, nowMs }: { shifts: MyShift[]; nowMs: number }) {
  const [showPast, setShowPast] = useState(false);
  const visible = shifts.filter((s) => showPast || new Date(s.endsAt).getTime() >= nowMs);
  const pastCount = shifts.length - shifts.filter((s) => new Date(s.endsAt).getTime() >= nowMs).length;

  const groups = new Map<string, MyShift[]>();
  for (const s of visible) {
    const key = formatJstDateKey(new Date(s.startsAt));
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  // Calendar: counts are per shift (one calendar event per shift).
  const upcoming = shifts.filter((s) => new Date(s.endsAt).getTime() >= nowMs);
  const upcomingCount = new Set(upcoming.map((s) => s.shiftId)).size;
  const unregisteredCount = new Set(upcoming.filter((s) => !s.calendarAdded).map((s) => s.shiftId)).size;

  // Two instances can book the same person at the same time — flag it.
  const overlaps = (s: MyShift) =>
    shifts.some((o) => o.id !== s.id && o.startsAt < s.endsAt && o.endsAt > s.startsAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-neutral-800">自分のシフト(全インスタンス)</h1>
        {pastCount > 0 && (
          <button type="button" onClick={() => setShowPast((v) => !v)} className="text-xs text-neutral-500 underline">
            {showPast ? "終了したシフトを隠す" : `終了したシフトも表示(${pastCount})`}
          </button>
        )}
      </div>

      <CalendarExportCard upcomingCount={upcomingCount} unregisteredCount={unregisteredCount} />

      {[...groups.entries()].map(([dateKey, list]) => (
        <section key={dateKey} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">{dateLabel(dateKey)}</h2>
          {list.map((s) => {
            const ended = new Date(s.endsAt).getTime() < nowMs;
            return (
              <div
                key={s.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm ${
                  ended ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-neutral-800">
                    {formatJstTime(new Date(s.startsAt))}〜{formatJstTime(new Date(s.endsAt))}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${shiftColor(s.role, s.roleColor).chip}`}>{s.role}</span>
                  <span
                    className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-bold text-white"
                    title={s.instanceName}
                  >
                    {s.instanceLabel || s.instanceName}
                  </span>
                  {!s.instanceActive && (
                    <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600">
                      停止中
                    </span>
                  )}
                  {!ended && !s.calendarAdded && (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500">
                      カレンダー未登録
                    </span>
                  )}
                  {overlaps(s) && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      他のシフトと時間が重なっています
                    </span>
                  )}
                </div>
                <Link href={`/shifts?instance=${s.instanceId}`} className="text-xs text-blue-600 hover:underline">
                  このインスタンスのシフトへ
                </Link>
              </div>
            );
          })}
        </section>
      ))}
      {groups.size === 0 && <p className="text-sm text-neutral-400">予定されている自分のシフトはありません</p>}
    </div>
  );
}
