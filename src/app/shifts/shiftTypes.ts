import { shiftColor } from "@/lib/shiftColors";

export type MemberOption = { id: string; name: string; image: string | null; unapproved: boolean };
export type RoleOption = { id: string; name: string; color: string | null };
export type AssignmentView = {
  assignmentId: string;
  memberId: string;
  role: string;
  name: string;
  image: string | null;
  isMe: boolean;
  // Invited but never signed in (so no notifications can reach them).
  unapproved: boolean;
  // Mine only: already put into my calendar and unchanged since.
  calendarAdded: boolean;
};
export type ShiftView = {
  id: string;
  startsAt: string;
  endsAt: string;
  assignments: AssignmentView[];
};

// A shift together with the assignments left after filtering. Edit/copy
// always use `shift` (the full roster), never the filtered one.
export type ShiftItem = { shift: ShiftView; assignments: AssignmentView[] };

// role name -> chosen palette key (null/absent = automatic color).
export type RoleColors = Record<string, string | null>;

// Stable color per role, shared by the list, the table and the PNG.
export function roleColor(role: string, colors?: RoleColors): string {
  return shiftColor(role, colors?.[role]).chip;
}

// Matching thin border for the table's bars.
export function roleBorder(role: string, colors?: RoleColors): string {
  return shiftColor(role, colors?.[role]).border;
}

// The same palette as hex, for drawing the PNG.
export function roleHex(role: string, colors?: RoleColors) {
  const { bg, text, line } = shiftColor(role, colors?.[role]);
  return { bg, text, line };
}

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function dateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}(${weekday})`;
}
