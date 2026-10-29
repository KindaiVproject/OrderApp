export type MemberOption = { id: string; name: string; image: string | null; unapproved: boolean };
export type RoleOption = { id: string; name: string };
export type AssignmentView = {
  memberId: string;
  role: string;
  name: string;
  image: string | null;
  isMe: boolean;
  // Invited but never signed in (so no notifications can reach them).
  unapproved: boolean;
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

// [chip colors, thin border color] per role; the full class names are spelled
// out so Tailwind can see them.
const ROLE_COLORS = [
  ["bg-blue-100 text-blue-800", "border-blue-300"],
  ["bg-green-100 text-green-800", "border-green-300"],
  ["bg-amber-100 text-amber-800", "border-amber-300"],
  ["bg-purple-100 text-purple-800", "border-purple-300"],
  ["bg-pink-100 text-pink-800", "border-pink-300"],
  ["bg-teal-100 text-teal-800", "border-teal-300"],
  ["bg-orange-100 text-orange-800", "border-orange-300"],
  ["bg-indigo-100 text-indigo-800", "border-indigo-300"],
] as const;

function roleIndex(role: string) {
  let hash = 0;
  for (const ch of role) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % ROLE_COLORS.length;
}

// Stable color per role name, shared by the list and the table.
export function roleColor(role: string): string {
  return ROLE_COLORS[roleIndex(role)][0];
}

// Matching thin border for the table's bars.
export function roleBorder(role: string): string {
  return ROLE_COLORS[roleIndex(role)][1];
}

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function dateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}(${weekday})`;
}
