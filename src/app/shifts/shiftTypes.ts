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

// Per role: Tailwind classes for the screen (spelled out so Tailwind sees
// them) and the same colors as hex for the PNG export, which draws on a canvas.
const ROLE_COLORS = [
  { chip: "bg-blue-100 text-blue-800", border: "border-blue-300", bg: "#dbeafe", text: "#1e40af", line: "#93c5fd" },
  { chip: "bg-green-100 text-green-800", border: "border-green-300", bg: "#dcfce7", text: "#166534", line: "#86efac" },
  { chip: "bg-amber-100 text-amber-800", border: "border-amber-300", bg: "#fef3c7", text: "#92400e", line: "#fcd34d" },
  { chip: "bg-purple-100 text-purple-800", border: "border-purple-300", bg: "#f3e8ff", text: "#6b21a8", line: "#d8b4fe" },
  { chip: "bg-pink-100 text-pink-800", border: "border-pink-300", bg: "#fce7f3", text: "#9d174d", line: "#f9a8d4" },
  { chip: "bg-teal-100 text-teal-800", border: "border-teal-300", bg: "#ccfbf1", text: "#115e59", line: "#5eead4" },
  { chip: "bg-orange-100 text-orange-800", border: "border-orange-300", bg: "#ffedd5", text: "#9a3412", line: "#fdba74" },
  { chip: "bg-indigo-100 text-indigo-800", border: "border-indigo-300", bg: "#e0e7ff", text: "#3730a3", line: "#a5b4fc" },
] as const;

function roleIndex(role: string) {
  let hash = 0;
  for (const ch of role) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % ROLE_COLORS.length;
}

// Stable color per role name, shared by the list and the table.
export function roleColor(role: string): string {
  return ROLE_COLORS[roleIndex(role)].chip;
}

// Matching thin border for the table's bars.
export function roleBorder(role: string): string {
  return ROLE_COLORS[roleIndex(role)].border;
}

// The same palette as hex, for drawing the PNG.
export function roleHex(role: string) {
  const { bg, text, line } = ROLE_COLORS[roleIndex(role)];
  return { bg, text, line };
}

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function dateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}(${weekday})`;
}
