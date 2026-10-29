"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { downloadSchedulePng } from "./exportPng";
import type { ShiftFormInitial } from "./ShiftFormModal";
import { assignLanes, buildSchedule, hhmm, scheduleDates, type ScheduleMode } from "./scheduleLayout";
import { dateLabel, roleBorder, roleColor, type RoleColors, type ShiftItem } from "./shiftTypes";

// Minimum width per hour. The track is flex-1, so on a wide parent the hours
// stretch to fill it; the room comes from the parent, not from fat cells.
const HOUR_PX = 72;
const LABEL_PX = 120;
const LANE_PX = 56;
const BAR_INSET_PX = 5;
// Even a 15-minute shift gets a readable bar; lane packing uses this visual
// length so neighbours stack instead of overlapping.
const MIN_BAR_PX = 108;
const MIN_BAR_MINUTES = Math.ceil((MIN_BAR_PX / HOUR_PX) * 60);

// シフト表: one day at a time with a time axis across. Rows are roles by
// default (who covers 調理 / レジ when, with their icons), or people (what each
// person does when). Scrolls sideways on phones.
export default function ShiftTable({
  items,
  roleOrder,
  title,
  roleColors,
  onAdd,
  onEdit,
}: {
  items: ShiftItem[];
  roleOrder: string[];
  // Shown on the exported PNG (the instance's name).
  title: string;
  // Colors the Admin chose per role (absent = automatic).
  roleColors: RoleColors;
  // Admin only. In the by-role view a "+" or a tap on an empty stretch of a
  // role's row starts a new shift for that role (and time) on the shown day.
  onAdd?: (initial: ShiftFormInitial) => void;
  // Admin only: tapping a bar edits that bar's shift (in either view).
  onEdit?: (shiftId: string) => void;
}) {
  const dates = scheduleDates(items);
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<ScheduleMode>("role");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const date = picked && dates.includes(picked) ? picked : dates[0];

  if (!date) return <p className="text-sm text-neutral-400">表示できるシフトがありません</p>;

  const { rows, axisStart, axisEnd } = buildSchedule(items, date, mode, roleOrder, Boolean(onAdd));
  const span = axisEnd - axisStart;
  const hours = span / 60;
  const trackWidth = hours * HOUR_PX;
  const hourMarks = Array.from({ length: hours }, (_, i) => axisStart + i * 60);

  async function exportPng() {
    setExporting(true);
    setExportError(null);
    try {
      // The export leaves out the empty rows an Admin sees for adding.
      await downloadSchedulePng({
        layout: buildSchedule(items, date, mode, roleOrder, false),
        mode,
        date,
        title,
        roleColors,
      });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "画像を作成できませんでした");
    } finally {
      setExporting(false);
    }
  }

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
        <button
          type="button"
          onClick={exportPng}
          disabled={exporting}
          className="ml-auto rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {exporting ? "作成中…" : `${dateLabel(date)}をPNGで保存`}
        </button>
      </div>
      {exportError && <p className="text-xs text-red-600">{exportError}</p>}

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
            const { placed, lanes } = assignLanes(row.bars, MIN_BAR_MINUTES);
            return (
              <div key={row.key} className="flex border-b border-neutral-100 last:border-b-0">
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 bg-white px-2 py-1.5"
                  style={{ width: LABEL_PX }}
                >
                  {mode === "role" ? (
                    <span className={`truncate rounded px-1.5 py-0.5 text-xs font-semibold ${roleColor(row.roleName!, roleColors)}`}>
                      {row.roleName}
                    </span>
                  ) : (
                    <>
                      <Avatar name={row.personName!} image={row.image} size={22} />
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-xs ${row.isMe ? "font-bold text-neutral-900" : "text-neutral-700"}`}
                        >
                          {row.personName}
                        </span>
                        {row.unapproved && <span className="block text-[9px] font-bold text-amber-700">未承認ユーザー</span>}
                      </span>
                    </>
                  )}
                  {onAdd && mode === "role" && (
                    <button
                      type="button"
                      onClick={() => onAdd({ date, start: "", end: "", rows: [{ memberId: "", role: row.key }] })}
                      aria-label={`${row.key}のシフトを追加`}
                      className="ml-auto shrink-0 rounded border border-neutral-300 px-1.5 text-xs leading-5 text-neutral-600 hover:bg-neutral-100"
                    >
                      ＋
                    </button>
                  )}
                </div>
                <div
                  className={`relative flex-1 ${onAdd && mode === "role" ? "cursor-copy" : ""}`}
                  onClick={(e) => {
                    // Only a tap on the empty track (not on a bar) adds a shift,
                    // starting at the tapped time rounded down to 15 minutes.
                    if (!onAdd || mode !== "role" || e.target !== e.currentTarget) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const minutes = axisStart + ((e.clientX - rect.left) / rect.width) * span;
                    const start = Math.max(0, Math.min(23 * 60 + 45, Math.floor(minutes / 15) * 15));
                    onAdd({ date, start: hhmm(start), end: "", rows: [{ memberId: "", role: row.key }] });
                  }}
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
                      {...(onEdit
                        ? {
                            role: "button",
                            tabIndex: 0,
                            onClick: () => onEdit(bar.shiftId),
                            onKeyDown: (e: React.KeyboardEvent) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onEdit(bar.shiftId);
                              }
                            },
                          }
                        : {})}
                      className={`absolute ${onEdit ? "cursor-pointer hover:brightness-95" : ""} flex items-center gap-1.5 overflow-hidden rounded-md border px-2 py-1 leading-snug ${roleColor(bar.roleName, roleColors)} ${roleBorder(bar.roleName, roleColors)} ${
                        bar.mine ? "ring-2 ring-blue-400" : ""
                      }`}
                      style={{
                        top: lane * LANE_PX + BAR_INSET_PX,
                        height: LANE_PX - BAR_INSET_PX * 2,
                        left: `${((bar.start - axisStart) / span) * 100}%`,
                        width: `${((bar.end - bar.start) / span) * 100}%`,
                        minWidth: MIN_BAR_PX,
                      }}
                    >
                      {mode === "role" && <Avatar name={bar.personName} image={bar.image} size={22} />}
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">
                          {mode === "role" ? bar.personName : bar.roleName}
                        </span>
                        <span className="block truncate text-[11px] tabular-nums opacity-70">
                          {hhmm(bar.start)}〜{hhmm(bar.end)}
                        </span>
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
      {onEdit && (
        <p className="text-[11px] leading-relaxed text-neutral-500">
          バーをタップするとそのシフトを編集できます。
          {onAdd && mode === "role" && "役割の行の空いているところをタップするとその時間から、「＋」ではその役割で、シフトを追加できます。"}
        </p>
      )}
    </div>
  );
}
