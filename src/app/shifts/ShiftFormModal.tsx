"use client";

import { useState } from "react";
import { addMinutesToTime, timeToMinutes } from "@/lib/shifts";
import MemberPicker from "./MemberPicker";
import type { MemberOption, RoleOption } from "./shiftTypes";

export type FormRow = { memberId: string; role: string };
export type ShiftFormInitial = { date: string; start: string; end: string; rows: FormRow[] };

const END_STEPS = [
  { label: "+15分", delta: 15 },
  { label: "−15分", delta: -15 },
  { label: "+1時間", delta: 60 },
  { label: "−1時間", delta: -60 },
];

// Adds a shift (shiftId null) or edits one. A new shift defaults to one hour:
// the end follows the start until the end is adjusted by hand.
export default function ShiftFormModal({
  instanceId,
  shiftId,
  initial,
  members,
  roles,
  onClose,
  onSaved,
}: {
  instanceId: string;
  shiftId: string | null;
  initial: ShiftFormInitial;
  members: MemberOption[];
  roles: RoleOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start);
  // A start with no end (e.g. from a tap on the schedule) defaults to +1 hour.
  const [end, setEnd] = useState(initial.end || (initial.start ? addMinutesToTime(initial.start, 60) : ""));
  const [endTouched, setEndTouched] = useState(Boolean(initial.end));
  const [rows, setRows] = useState<FormRow[]>(initial.rows.length > 0 ? initial.rows : [{ memberId: "", role: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeStart(value: string) {
    setStart(value);
    if (value && !endTouched) setEnd(addMinutesToTime(value, 60));
  }

  function adjustEnd(delta: number) {
    const base = end || (start ? addMinutesToTime(start, 60) : "");
    if (!base) return;
    let next = addMinutesToTime(base, delta);
    if (start && timeToMinutes(next) <= timeToMinutes(start)) next = addMinutesToTime(start, 1);
    setEnd(next);
    setEndTouched(true);
  }

  function updateRow(index: number, patch: Partial<FormRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  // Registered roles, plus a row's own role when it is no longer registered
  // (older shifts) so editing doesn't silently blank it.
  const roleNames = (current: string) => {
    const names = roles.map((r) => r.name);
    return current && !names.includes(current) ? [...names, current] : names;
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(shiftId ? `/api/shifts/${shiftId}` : "/api/shifts", {
        method: shiftId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        // Rows left without a member are dropped rather than rejected.
        body: JSON.stringify({ instanceId, date, start, end, assignments: rows.filter((r) => r.memberId) }),
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
        <h2 className="text-base font-semibold text-neutral-800">{shiftId ? "シフトを編集" : "シフトを追加"}</h2>

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
              onChange={(e) => changeStart(e.target.value)}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-600">
            終了
            <input
              type="time"
              required
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setEndTouched(true);
              }}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-neutral-500">終了を調整</span>
          {END_STEPS.map((step) => (
            <button
              key={step.label}
              type="button"
              onClick={() => adjustEnd(step.delta)}
              disabled={!start && !end}
              className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 disabled:opacity-40"
            >
              {step.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-neutral-600">担当と役割</span>
          {roles.length === 0 && (
            <p className="text-[11px] text-amber-700">
              役割が未登録です。いったん閉じて「役割の設定」から追加してください。
            </p>
          )}
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <MemberPicker
                inline
                options={members}
                value={row.memberId}
                onChange={(id) => updateRow(i, { memberId: id })}
                placeholder="担当者を選択"
                ariaLabel="担当者"
              />
              <select
                value={row.role}
                onChange={(e) => updateRow(i, { role: e.target.value })}
                className="w-28 rounded border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="">役割</option>
                {roleNames(row.role).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                aria-label="この行を削除"
                className="px-1 py-1.5 text-neutral-400 hover:text-red-600"
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
