import { formatJstDateKey, formatJstTime } from "@/lib/datetime";
import { timeToMinutes } from "@/lib/shifts";
import type { ShiftItem } from "./shiftTypes";

// Layout of one day of the schedule table, shared by the on-screen table and
// the PNG export so both always show the same thing.

export type ScheduleMode = "role" | "person";

export type ScheduleBar = {
  shiftId: string;
  assignmentId: string;
  title: string;
  roleName: string;
  personName: string;
  image: string | null;
  unapproved: boolean;
  start: number; // minutes since midnight (JST)
  end: number;
  mine: boolean;
};

export type ScheduleRow = {
  key: string;
  // Role mode: the role. Person mode: the person.
  roleName: string | null;
  personName: string | null;
  image: string | null;
  unapproved: boolean;
  isMe: boolean;
  bars: ScheduleBar[];
};

export type ScheduleLayout = { rows: ScheduleRow[]; axisStart: number; axisEnd: number };

const minutesOfDay = (iso: string) => timeToMinutes(formatJstTime(new Date(iso)));
export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function scheduleDates(items: ShiftItem[]) {
  return [...new Set(items.map((i) => formatJstDateKey(new Date(i.shift.startsAt))))].sort();
}

// `includeEmptyRoles` adds a row for every registered role even with nobody on
// it (role mode), so an Admin can start a shift from an empty role row.
export function buildSchedule(
  items: ShiftItem[],
  date: string,
  mode: ScheduleMode,
  roleOrder: string[],
  includeEmptyRoles = false,
): ScheduleLayout {
  const dayItems = items.filter((i) => formatJstDateKey(new Date(i.shift.startsAt)) === date);

  const rowMap = new Map<string, ScheduleRow>();
  for (const { shift, assignments } of dayItems) {
    const start = minutesOfDay(shift.startsAt);
    const end = minutesOfDay(shift.endsAt);
    for (const a of assignments) {
      const key = mode === "role" ? a.role : a.memberId;
      let row = rowMap.get(key);
      if (!row) {
        row = {
          key,
          roleName: mode === "role" ? a.role : null,
          personName: mode === "person" ? a.name : null,
          image: mode === "person" ? a.image : null,
          unapproved: mode === "person" && a.unapproved,
          isMe: mode === "person" && a.isMe,
          bars: [],
        };
        rowMap.set(key, row);
      }
      row.bars.push({
        shiftId: shift.id,
        assignmentId: a.assignmentId,
        title: `${a.name}${a.unapproved ? "(未承認ユーザー)" : ""} ${a.role} ${hhmm(start)}〜${hhmm(end)}`,
        roleName: a.role,
        personName: a.name,
        image: a.image,
        unapproved: a.unapproved,
        start,
        end,
        mine: a.isMe,
      });
    }
  }

  if (includeEmptyRoles && mode === "role") {
    for (const name of roleOrder) {
      if (!rowMap.has(name)) {
        rowMap.set(name, {
          key: name,
          roleName: name,
          personName: null,
          image: null,
          unapproved: false,
          isMe: false,
          bars: [],
        });
      }
    }
  }

  const roleRank = (name: string) => {
    const i = roleOrder.indexOf(name);
    return i === -1 ? roleOrder.length : i;
  };
  const earliest = (r: ScheduleRow) => Math.min(...r.bars.map((b) => b.start));
  const rows = [...rowMap.values()].sort((a, b) =>
    mode === "role"
      ? roleRank(a.roleName!) - roleRank(b.roleName!) || a.roleName!.localeCompare(b.roleName!)
      : earliest(a) - earliest(b) || a.personName!.localeCompare(b.personName!),
  );

  // Shifts with nobody assigned still set the axis, so empty slots show.
  const starts = [...rows.flatMap((r) => r.bars.map((b) => b.start)), ...dayItems.map((i) => minutesOfDay(i.shift.startsAt))];
  const ends = [...rows.flatMap((r) => r.bars.map((b) => b.end)), ...dayItems.map((i) => minutesOfDay(i.shift.endsAt))];
  const axisStart = Math.floor(Math.min(...starts) / 60) * 60;
  const axisEnd = Math.max(axisStart + 60, Math.ceil(Math.max(...ends) / 60) * 60);
  return { rows, axisStart, axisEnd };
}

// Greedy lane packing: bars that overlap in time go on separate lanes, so
// several people on the same role at the same hour stack instead of hiding
// each other. `minMinutes` is each bar's minimum visual length.
export function assignLanes(bars: ScheduleBar[], minMinutes: number) {
  const sorted = [...bars].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const placed = sorted.map((bar) => {
    let lane = laneEnds.findIndex((end) => end <= bar.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = Math.max(bar.end, bar.start + minMinutes);
    return { bar, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}
