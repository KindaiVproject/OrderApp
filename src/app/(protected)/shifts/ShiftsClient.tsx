"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import ConfirmModal from "@/components/ConfirmModal";
import { formatJstDateKey, formatJstTime } from "@/lib/datetime";

type MemberOption = { id: string; name: string };
type ShiftView = {
  id: string;
  startsAt: string;
  endsAt: string;
  assignments: { memberId: string; role: string; name: string; image: string | null; isMe: boolean }[];
};
type Row = { memberId: string; role: string };

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function dateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}(${weekday})`;
}

export default function ShiftsClient({
  isAdmin,
  nowMs,
  members,
  shifts,
}: {
  isAdmin: boolean;
  // Server render time, so "finished" shifts are decided without Date.now() here.
  nowMs: number;
  members: MemberOption[];
  shifts: ShiftView[];
}) {
  const router = useRouter();
  const [showPast, setShowPast] = useState(false);
  // null = closed, "new" = adding, otherwise editing that shift.
  const [editing, setEditing] = useState<ShiftView | "new" | null>(null);
  const [deleting, setDeleting] = useState<ShiftView | null>(null);

  const now = nowMs;
  const visible = shifts.filter((s) => showPast || new Date(s.endsAt).getTime() >= now);
  const pastCount = shifts.length - shifts.filter((s) => new Date(s.endsAt).getTime() >= now).length;

  const groups = new Map<string, ShiftView[]>();
  for (const s of visible) {
    const key = formatJstDateKey(new Date(s.startsAt));
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-neutral-800">シフト</h1>
        <div className="flex items-center gap-3">
          {pastCount > 0 && (
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              className="text-xs text-neutral-500 underline"
            >
              {showPast ? "終了したシフトを隠す" : `終了したシフトも表示(${pastCount})`}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              シフトを追加
            </button>
          )}
        </div>
      </div>

      {[...groups.entries()].map(([dateKey, list]) => (
        <section key={dateKey} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">{dateLabel(dateKey)}</h2>
          {list.map((shift) => {
            const ended = new Date(shift.endsAt).getTime() < now;
            const mine = shift.assignments.some((a) => a.isMe);
            return (
              <div
                key={shift.id}
                className={`rounded-lg border bg-white p-3 shadow-sm ${
                  mine ? "border-blue-300" : "border-neutral-200"
                } ${ended ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums text-neutral-800">
                    {formatJstTime(new Date(shift.startsAt))}〜{formatJstTime(new Date(shift.endsAt))}
                    {mine && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                        あなたのシフト
                      </span>
                    )}
                  </span>
                  {isAdmin && (
                    <span className="flex items-center gap-3 text-xs">
                      <button type="button" onClick={() => setEditing(shift)} className="text-blue-600 hover:underline">
                        編集
                      </button>
                      <button type="button" onClick={() => setDeleting(shift)} className="text-red-600 hover:underline">
                        削除
                      </button>
                    </span>
                  )}
                </div>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {shift.assignments.map((a) => (
                    <li key={`${a.memberId}-${a.role}`} className="flex items-center gap-2 text-sm">
                      <Avatar name={a.name} image={a.image} size={24} />
                      <span className={a.isMe ? "font-semibold text-neutral-900" : "text-neutral-700"}>{a.name}</span>
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">{a.role}</span>
                    </li>
                  ))}
                  {shift.assignments.length === 0 && (
                    <li className="text-xs text-neutral-400">担当者が未設定です</li>
                  )}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
      {groups.size === 0 && <p className="text-sm text-neutral-400">シフトはまだありません</p>}

      {editing && (
        <ShiftFormModal
          shift={editing === "new" ? null : editing}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="シフトを削除"
          message={`${dateLabel(formatJstDateKey(new Date(deleting.startsAt)))} ${formatJstTime(
            new Date(deleting.startsAt),
          )}〜${formatJstTime(new Date(deleting.endsAt))} のシフトを削除しますか？`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const res = await fetch(`/api/shifts/${deleting.id}`, { method: "DELETE" });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error ?? "削除に失敗しました");
            }
            setDeleting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ShiftFormModal({
  shift,
  members,
  onClose,
  onSaved,
}: {
  shift: ShiftView | null;
  members: MemberOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(shift ? formatJstDateKey(new Date(shift.startsAt)) : "");
  const [start, setStart] = useState(shift ? formatJstTime(new Date(shift.startsAt)) : "");
  const [end, setEnd] = useState(shift ? formatJstTime(new Date(shift.endsAt)) : "");
  const [rows, setRows] = useState<Row[]>(
    shift
      ? shift.assignments.map((a) => ({ memberId: a.memberId, role: a.role }))
      : [{ memberId: "", role: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(shift ? `/api/shifts/${shift.id}` : "/api/shifts", {
        method: shift ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        // Rows left half-empty (no member) are dropped rather than rejected.
        body: JSON.stringify({ date, start, end, assignments: rows.filter((r) => r.memberId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={save}
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl"
      >
        <h2 className="text-base font-semibold text-neutral-800">{shift ? "シフトを編集" : "シフトを追加"}</h2>

        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          日付
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-600">
            開始
            <input
              type="time"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-600">
            終了
            <input
              type="time"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-neutral-600">担当と役割</span>
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={row.memberId}
                onChange={(e) => updateRow(i, { memberId: e.target.value })}
                className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="">担当者を選択</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                value={row.role}
                onChange={(e) => updateRow(i, { role: e.target.value })}
                placeholder="役割(例: レジ)"
                maxLength={20}
                className="w-28 rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                aria-label="この行を削除"
                className="px-1 text-neutral-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { memberId: "", role: "" }])}
            className="self-start text-xs text-blue-600 hover:underline"
          >
            ＋ 担当を追加
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-neutral-600">
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
