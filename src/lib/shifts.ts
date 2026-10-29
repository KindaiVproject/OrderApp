import { formatJstTime } from "@/lib/datetime";

export const MAX_ROLE_LENGTH = 20;

export type ShiftInput = {
  startsAt: Date;
  endsAt: Date;
  assignments: { memberId: string; role: string }[];
};

// Body: { date: "YYYY-MM-DD", start: "HH:MM", end: "HH:MM",
//         assignments: [{ memberId, role }] } — times are JST, minute precision.
// `allowedRoles` = the instance's registered roles (plus, when editing, roles
// the shift already uses, so legacy free-text roles survive an edit).
export function parseShiftInput(
  body: unknown,
  validMemberIds: Set<string>,
  allowedRoles: Set<string>,
): { error: string } | { input: ShiftInput } {
  const b = (body ?? {}) as Record<string, unknown>;
  const date = typeof b.date === "string" ? b.date : "";
  const start = typeof b.start === "string" ? b.start : "";
  const end = typeof b.end === "string" ? b.end : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "日付を入力してください" };
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
    return { error: "開始・終了時刻を入力してください" };
  }
  const startsAt = new Date(`${date}T${start}:00+09:00`);
  const endsAt = new Date(`${date}T${end}:00+09:00`);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { error: "日付・時刻の形式が正しくありません" };
  }
  if (endsAt <= startsAt) return { error: "終了時刻は開始時刻より後にしてください" };

  const raw = Array.isArray(b.assignments) ? b.assignments : [];
  const assignments: ShiftInput["assignments"] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const memberId = typeof item?.memberId === "string" ? item.memberId : "";
    const role = typeof item?.role === "string" ? item.role.trim() : "";
    if (!validMemberIds.has(memberId)) return { error: "メンバーの指定が不正です" };
    if (!role) return { error: "役割を入力してください" };
    if (!allowedRoles.has(role)) return { error: "役割は登録済みのものから選んでください" };
    const key = `${memberId}\n${role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    assignments.push({ memberId, role });
  }
  return { input: { startsAt, endsAt, assignments } };
}

export function formatShiftRange(startsAt: Date, endsAt: Date) {
  return `${formatJstTime(startsAt)}〜${formatJstTime(endsAt)}`;
}

// "HH:MM" + delta minutes, clamped to the same day (00:00–23:59): shifts
// never cross midnight.
export function addMinutesToTime(time: string, delta: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + delta));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
