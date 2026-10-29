import { formatJstTime } from "@/lib/datetime";

export const MAX_ROLE_LENGTH = 20;

export type ShiftInput = {
  startsAt: Date;
  endsAt: Date;
  assignments: { memberId: string; role: string }[];
};

// Body: { date: "YYYY-MM-DD", start: "HH:MM", end: "HH:MM",
//         assignments: [{ memberId, role }] } — times are JST, minute precision.
export function parseShiftInput(
  body: unknown,
  validMemberIds: Set<string>,
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
    if (role.length > MAX_ROLE_LENGTH) {
      return { error: `役割は${MAX_ROLE_LENGTH}文字以内で入力してください` };
    }
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
