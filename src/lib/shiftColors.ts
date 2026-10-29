// Colors a shift role can have. Each entry carries Tailwind classes for the
// screen (spelled out in full so Tailwind sees them) and the same colors as hex
// for the PNG export, which draws on a canvas. An Admin picks one per role;
// roles with none get an automatic one derived from the name.
export const SHIFT_COLORS = [
  { key: "blue", label: "青", chip: "bg-blue-100 text-blue-800", border: "border-blue-300", bg: "#dbeafe", text: "#1e40af", line: "#93c5fd" },
  { key: "green", label: "緑", chip: "bg-green-100 text-green-800", border: "border-green-300", bg: "#dcfce7", text: "#166534", line: "#86efac" },
  { key: "amber", label: "黄", chip: "bg-amber-100 text-amber-800", border: "border-amber-300", bg: "#fef3c7", text: "#92400e", line: "#fcd34d" },
  { key: "purple", label: "紫", chip: "bg-purple-100 text-purple-800", border: "border-purple-300", bg: "#f3e8ff", text: "#6b21a8", line: "#d8b4fe" },
  { key: "pink", label: "ピンク", chip: "bg-pink-100 text-pink-800", border: "border-pink-300", bg: "#fce7f3", text: "#9d174d", line: "#f9a8d4" },
  { key: "teal", label: "青緑", chip: "bg-teal-100 text-teal-800", border: "border-teal-300", bg: "#ccfbf1", text: "#115e59", line: "#5eead4" },
  { key: "orange", label: "オレンジ", chip: "bg-orange-100 text-orange-800", border: "border-orange-300", bg: "#ffedd5", text: "#9a3412", line: "#fdba74" },
  { key: "indigo", label: "藍", chip: "bg-indigo-100 text-indigo-800", border: "border-indigo-300", bg: "#e0e7ff", text: "#3730a3", line: "#a5b4fc" },
  { key: "red", label: "赤", chip: "bg-red-100 text-red-800", border: "border-red-300", bg: "#fee2e2", text: "#991b1b", line: "#fca5a5" },
  { key: "gray", label: "グレー", chip: "bg-neutral-200 text-neutral-700", border: "border-neutral-400", bg: "#e5e5e5", text: "#404040", line: "#a3a3a3" },
] as const;

export type ShiftColor = (typeof SHIFT_COLORS)[number];
export const SHIFT_COLOR_KEYS: readonly string[] = SHIFT_COLORS.map((c) => c.key);

// Automatic colors only use the first eight, which are the colors roles had
// before they could be chosen, so nothing changes color on its own.
const AUTO_COUNT = 8;

export function shiftColor(role: string, key?: string | null): ShiftColor {
  const chosen = key ? SHIFT_COLORS.find((c) => c.key === key) : undefined;
  if (chosen) return chosen;
  let hash = 0;
  for (const ch of role) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SHIFT_COLORS[hash % AUTO_COUNT];
}
