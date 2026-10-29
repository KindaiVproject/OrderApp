"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Avatar from "@/components/Avatar";
import { isDesktopOs } from "@/lib/platform";
import { downloadSchedulePng } from "./exportPng";
import type { ShiftFormInitial } from "./ShiftFormModal";
import {
  assignLanes,
  buildSchedule,
  hhmm,
  scheduleDates,
  type ScheduleBar,
  type ScheduleMode,
} from "./scheduleLayout";
import { dateLabel, roleBorder, roleColor, type RoleColors, type ShiftItem } from "./shiftTypes";

// Scrolling should be a last resort: the table must fit a landscape phone
// (about 900px) for a 9:00-20:00 day, so an hour may shrink to HOUR_MIN_PX
// (11h * 40 + the label column = ~540px) and the hours otherwise stretch to
// fill the parent. Bars adapt to their width (see the @container below), so a
// narrow one-hour bar stacks icon / name / time instead of clipping.
const HOUR_MIN_PX = 40;
const LABEL_PX = 96;
const LANE_PX = 64;
const BAR_INSET_PX = 4;
// A bar shorter than this is drawn this wide (an icon plus a little text).
const MIN_BAR_PX = 56;

const SNAP_MIN = 15;
const DAY_END_MIN = 23 * 60 + 59;
// Pointer movement under this many pixels is a click, not a drag.
const DRAG_THRESHOLD_PX = 4;
const subscribeNever = () => () => {};

type DragKind = "move" | "start" | "end";
type Drag = {
  bar: ScheduleBar;
  kind: DragKind;
  startX: number;
  startY: number;
  start: number;
  end: number;
  role: string;
  dy: number;
  moved: boolean;
};

// Width of an element, kept up to date (for the real pixels-per-hour).
function useElementWidth() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

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
  onMove,
  refreshing = false,
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
  // Admin only, desktop OS only (mouse): drag a bar's edges to change its start
  // or end, or drag the bar to move it (up/down onto another role row to change
  // the role). Times snap to 15 minutes. Rejects with a message on failure.
  onMove?: (change: { assignmentId: string; start: string; end: string; role: string }) => Promise<void>;
  // The parent is reloading after a save (keeps the dropped position meanwhile).
  refreshing?: boolean;
}) {
  const dates = scheduleDates(items);
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<ScheduleMode>("role");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [axisRef, trackPx] = useElementWidth();
  const desktop = useSyncExternalStore(subscribeNever, isDesktopOs, () => false);
  const [drag, setDrag] = useState<Drag | null>(null);
  // The just-dropped bar stays where it was dropped until the reload lands.
  const [dropped, setDropped] = useState<{ assignmentId: string; start: number; end: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const justDragged = useRef(false);
  const date = picked && dates.includes(picked) ? picked : dates[0];

  if (!date) return <p className="text-sm text-neutral-400">表示できるシフトがありません</p>;

  const { rows, axisStart, axisEnd } = buildSchedule(items, date, mode, roleOrder, Boolean(onAdd));
  const span = axisEnd - axisStart;
  const hours = span / 60;
  const minTrackWidth = hours * HOUR_MIN_PX;
  // Real pixels per hour once measured; the minimum before that.
  const pxPerHour = trackPx > 0 ? trackPx / hours : HOUR_MIN_PX;
  const minBarMinutes = Math.ceil((MIN_BAR_PX / pxPerHour) * 60);
  const canDrag = desktop && Boolean(onMove) && mode === "role";
  const hourMarks = Array.from({ length: hours }, (_, i) => axisStart + i * 60);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  function beginDrag(e: React.PointerEvent<HTMLElement>, bar: ScheduleBar, kind: DragKind) {
    if (!canDrag || e.button !== 0) return;
    e.stopPropagation();
    justDragged.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ bar, kind, startX: e.clientX, startY: e.clientY, start: bar.start, end: bar.end, role: bar.roleName, dy: 0, moved: false });
  }

  // The drag as it stands with the pointer at (x, y).
  function dragAt(d: Drag, x: number, y: number): Drag {
    const dx = x - d.startX;
    const dy = y - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return d;
    const delta = Math.round(((dx / pxPerHour) * 60) / SNAP_MIN) * SNAP_MIN;
    const { start: s0, end: e0 } = d.bar;
    let start = s0;
    let end = e0;
    let role = d.role;
    if (d.kind === "start") start = clamp(s0 + delta, 0, e0 - SNAP_MIN);
    else if (d.kind === "end") end = clamp(e0 + delta, s0 + SNAP_MIN, DAY_END_MIN);
    else {
      const length = e0 - s0;
      start = clamp(s0 + delta, 0, DAY_END_MIN - length);
      end = start + length;
      // Dropping on another role's row changes the role. The dragged bar sits
      // inside its own row, so find the row by position, not by what is under
      // the pointer.
      const hit = [...document.querySelectorAll<HTMLElement>("[data-role-row]")].find((el) => {
        const rect = el.getBoundingClientRect();
        return y >= rect.top && y < rect.bottom;
      });
      const key = hit?.dataset.roleRow;
      role = key && rows.some((r) => r.key === key) ? key : d.bar.roleName;
    }
    return { ...d, start, end, role, dy: d.kind === "move" ? dy : 0, moved: true };
  }

  function moveDrag(e: React.PointerEvent<HTMLElement>) {
    if (drag) setDrag(dragAt(drag, e.clientX, e.clientY));
  }

  async function endDrag(e: React.PointerEvent<HTMLElement>) {
    // Settle on where the pointer was released, not on the last move event.
    const d = drag ? dragAt(drag, e.clientX, e.clientY) : null;
    setDrag(null);
    if (!d || !d.moved || !onMove) return;
    justDragged.current = true; // the click that follows the drop must not open the editor
    const { bar } = d;
    if (d.start === bar.start && d.end === bar.end && d.role === bar.roleName) return;
    setDropped({ assignmentId: bar.assignmentId, start: d.start, end: d.end });
    setSaving(true);
    setMoveError(null);
    try {
      await onMove({ assignmentId: bar.assignmentId, start: hhmm(d.start), end: hhmm(d.end), role: d.role });
    } catch (err) {
      setDropped(null);
      setMoveError(err instanceof Error ? err.message : "変更に失敗しました");
    } finally {
      setSaving(false);
    }
  }

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
      {moveError && <p className="text-xs text-red-600">{moveError}</p>}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div style={{ minWidth: LABEL_PX + minTrackWidth }}>
          <div className="flex border-b border-neutral-200 text-[10px] text-neutral-500">
            <div className="sticky left-0 z-10 shrink-0 bg-white" style={{ width: LABEL_PX }} />
            <div ref={axisRef} className="relative h-6 flex-1">
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
            const { placed, lanes } = assignLanes(row.bars, minBarMinutes);
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
                  data-role-row={mode === "role" ? row.key : undefined}
                  className={`relative flex-1 ${onAdd && mode === "role" ? "cursor-copy" : ""} ${
                    drag?.kind === "move" && drag.moved && drag.role === row.key && drag.role !== drag.bar.roleName
                      ? "bg-blue-50"
                      : ""
                  }`}
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
                  {placed.map(({ bar, lane }) => {
                    // Live while dragging; the dropped position while saving/reloading.
                    const live = drag && drag.bar.assignmentId === bar.assignmentId ? drag : null;
                    const keep = !live && dropped && (saving || refreshing) && dropped.assignmentId === bar.assignmentId;
                    const start = live ? live.start : keep ? dropped.start : bar.start;
                    const end = live ? live.end : keep ? dropped.end : bar.end;
                    return (
                      <div
                        key={bar.assignmentId}
                        title={bar.title}
                        {...(onEdit
                          ? {
                              role: "button",
                              tabIndex: 0,
                              onClick: () => {
                                if (justDragged.current) {
                                  justDragged.current = false;
                                  return;
                                }
                                onEdit(bar.shiftId);
                              },
                              onKeyDown: (e: React.KeyboardEvent) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onEdit(bar.shiftId);
                                }
                              },
                            }
                          : {})}
                        {...(canDrag
                          ? {
                              onPointerDown: (e: React.PointerEvent<HTMLElement>) => beginDrag(e, bar, "move"),
                              onPointerMove: moveDrag,
                              onPointerUp: endDrag,
                              onPointerCancel: endDrag,
                            }
                          : {})}
                        className={`absolute ${onEdit ? "cursor-pointer hover:brightness-95" : ""} ${
                          canDrag ? "select-none cursor-grab active:cursor-grabbing" : ""
                        } ${live?.moved ? "z-20 opacity-90 shadow-lg" : ""} ${keep && saving ? "opacity-60" : ""} overflow-hidden rounded-md border ${roleColor(bar.roleName, roleColors)} ${roleBorder(bar.roleName, roleColors)} ${
                          bar.mine ? "ring-2 ring-blue-400" : ""
                        }`}
                        style={{
                          top: lane * LANE_PX + BAR_INSET_PX,
                          height: LANE_PX - BAR_INSET_PX * 2,
                          left: `${((start - axisStart) / span) * 100}%`,
                          width: `${((end - start) / span) * 100}%`,
                          minWidth: MIN_BAR_PX,
                          transform: live?.moved && live.dy ? `translateY(${live.dy}px)` : undefined,
                        }}
                      >
                        {/* Resize handles on the left/right edges (desktop, role view). */}
                        {canDrag && (
                          <>
                            <span
                              aria-hidden
                              onPointerDown={(e) => beginDrag(e, bar, "start")}
                              className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize hover:bg-black/10"
                            />
                            <span
                              aria-hidden
                              onPointerDown={(e) => beginDrag(e, bar, "end")}
                              className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize hover:bg-black/10"
                            />
                          </>
                        )}
                        {/* A container query on the bar's own width: stacked when
                            narrow, side by side from 104px up (@min-[104px]). The
                            content is left-aligned. */}
                        <div className="@container h-full px-1.5 py-0.5 text-left">
                          <div className="flex h-full min-w-0 flex-col items-start justify-center gap-0.5 leading-tight @min-[104px]:flex-row @min-[104px]:items-center @min-[104px]:justify-start @min-[104px]:gap-1.5">
                            {mode === "role" && <Avatar name={bar.personName} image={bar.image} size={20} />}
                            <span className="min-w-0 max-w-full text-left">
                              <span className="block truncate text-[11px] font-semibold @min-[104px]:text-xs">
                                {mode === "role" ? bar.personName : bar.roleName}
                              </span>
                              <span className="block truncate text-[10px] tabular-nums opacity-70 @min-[104px]:text-[11px]">
                                {hhmm(start)}〜{hhmm(end)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <p className="p-3 text-xs text-neutral-400">この日は担当者が未設定です</p>}
        </div>
      </div>
      {onEdit && (
        <p className="text-[11px] leading-relaxed text-neutral-500">
          バーをタップするとそのシフトを編集できます。{canDrag && "バーの端をドラッグすると開始・終了を、バーをドラッグすると時間(上下に動かすと役割)を、15分単位で変えられます。"}
          {onAdd && mode === "role" && "役割の行の空いているところをタップするとその時間から、「＋」ではその役割で、シフトを追加できます。"}
        </p>
      )}
    </div>
  );
}
