"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Avatar from "@/components/Avatar";
import ConfirmModal from "@/components/ConfirmModal";
import { formatJstDateKey, formatJstTime, nextFullHourJst } from "@/lib/datetime";
import MemberPicker from "./MemberPicker";
import RolesModal from "./RolesModal";
import ShiftFormModal, { type ShiftFormInitial } from "./ShiftFormModal";
import ShiftTable from "./ShiftTable";
import type { PickerOption } from "./MemberPicker";
import {
  dateLabel,
  roleColor,
  type MemberOption,
  type RoleColors,
  type RoleOption,
  type ShiftItem,
  type ShiftView,
} from "./shiftTypes";

type Form = { shiftId: string | null; initial: ShiftFormInitial };

const timeRange = (s: ShiftView) =>
  `${formatJstTime(new Date(s.startsAt))}〜${formatJstTime(new Date(s.endsAt))}`;

export default function ShiftsClient({
  instanceId,
  instanceName,
  isAdmin,
  nowMs,
  members,
  roles,
  shifts,
}: {
  instanceId: string;
  instanceName: string;
  isAdmin: boolean;
  // Server render time, so "finished" shifts are decided without Date.now() here.
  nowMs: number;
  members: MemberOption[];
  roles: RoleOption[];
  shifts: ShiftView[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "table">("list");
  const [showPast, setShowPast] = useState(false);
  const [myOnly, setMyOnly] = useState(false);
  const [fMember, setFMember] = useState("");
  const [fRole, setFRole] = useState("");
  const [fDate, setFDate] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [deleting, setDeleting] = useState<ShiftView | null>(null);
  const [managingRoles, setManagingRoles] = useState(false);
  // True while router.refresh() is bringing the saved change back from the server.
  const [refreshing, startRefresh] = useTransition();

  const dateOf = (s: ShiftView) => formatJstDateKey(new Date(s.startsAt));
  const pool = shifts.filter((s) => showPast || new Date(s.endsAt).getTime() >= nowMs);
  const pastCount = shifts.filter((s) => new Date(s.endsAt).getTime() < nowMs).length;

  // Filter choices come from what is actually on the board.
  const memberChoices = new Map<string, PickerOption>();
  const roleChoices = new Set<string>();
  for (const s of pool) {
    for (const a of s.assignments) {
      memberChoices.set(a.memberId, { id: a.memberId, name: a.name, image: a.image, unapproved: a.unapproved });
      roleChoices.add(a.role);
    }
  }
  const dateChoices = [...new Set(pool.map(dateOf))].sort();

  // Filters narrow the assignments; a shift drops out when an assignment
  // filter is on and nothing is left. Edit/copy still use the full shift.
  const assignmentFilterOn = myOnly || Boolean(fMember) || Boolean(fRole);
  const items: ShiftItem[] = pool
    .filter((s) => !fDate || dateOf(s) === fDate)
    .map((shift) => ({
      shift,
      assignments: shift.assignments.filter(
        (a) => (!myOnly || a.isMe) && (!fMember || a.memberId === fMember) && (!fRole || a.role === fRole),
      ),
    }))
    .filter((i) => !assignmentFilterOn || i.assignments.length > 0);
  const filtersOn = assignmentFilterOn || Boolean(fDate);

  const groups = new Map<string, ShiftItem[]>();
  for (const item of items) {
    const key = dateOf(item.shift);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  // A new shift defaults to the next full hour (now 03:18 -> 04:00, one hour
  // long). Read at click time so a page left open still gets the right hour.
  const newShiftInitial = (): ShiftFormInitial => {
    const next = nextFullHourJst(Date.now());
    return { date: next.date, start: next.time, end: "", rows: [] };
  };
  // The shift as the form shows it (date, times and the full roster).
  const initialOf = (s: ShiftView): ShiftFormInitial => ({
    date: dateOf(s),
    start: formatJstTime(new Date(s.startsAt)),
    end: formatJstTime(new Date(s.endsAt)),
    rows: s.assignments.map((a) => ({ memberId: a.memberId, role: a.role })),
  });
  // Roles higher in the Admin's priority list come first within a shift.
  const roleColors: RoleColors = Object.fromEntries(roles.map((r) => [r.name, r.color]));
  const roleRank = (role: string) => {
    const i = roles.findIndex((r) => r.name === role);
    return i === -1 ? roles.length : i;
  };
  // Dragging a bar on the schedule table: one person's time and/or role.
  async function moveAssignment(change: { assignmentId: string; start: string; end: string; role: string }) {
    const res = await fetch(`/api/shifts/assignments/${change.assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: change.start, end: change.end, role: change.role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "変更に失敗しました");
    }
    startRefresh(() => router.refresh());
  }
  const openEdit = (s: ShiftView) => setForm({ shiftId: s.id, initial: initialOf(s) });

  return (
    // The schedule table gets a much wider parent (the list stays narrow).
    <div className={`mx-auto flex w-full flex-col gap-4 p-4 ${mode === "table" ? "max-w-6xl" : "max-w-3xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-neutral-800">シフト</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManagingRoles(true)}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700"
            >
              役割の設定
            </button>
            <button
              type="button"
              onClick={() => setForm({ shiftId: null, initial: newShiftInitial() })}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              シフトを追加
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded border border-neutral-300 text-xs font-medium">
            {(["list", "table"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 ${mode === m ? "bg-neutral-900 text-white" : "bg-white text-neutral-600"}`}
              >
                {m === "list" ? "リスト" : "シフト表"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMyOnly((v) => !v)}
            aria-pressed={myOnly}
            className={`rounded border px-3 py-1.5 text-xs font-medium ${
              myOnly ? "border-blue-500 bg-blue-50 text-blue-700" : "border-neutral-300 bg-white text-neutral-600"
            }`}
          >
            自分のシフトのみ
          </button>
          {pastCount > 0 && (
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              className="ml-auto text-xs text-neutral-500 underline"
            >
              {showPast ? "終了したシフトを隠す" : `終了したシフトも表示(${pastCount})`}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={fDate}
            onChange={(e) => setFDate(e.target.value)}
            aria-label="日付で絞り込み"
            className="rounded border border-neutral-300 px-2 py-1.5"
          >
            <option value="">すべての日</option>
            {dateChoices.map((d) => (
              <option key={d} value={d}>
                {dateLabel(d)}
              </option>
            ))}
          </select>
          <div className="w-44">
            <MemberPicker
              options={[...memberChoices.values()]}
              value={fMember}
              onChange={setFMember}
              placeholder="全員"
              emptyLabel="全員"
              ariaLabel="担当者で絞り込み"
            />
          </div>
          <select
            value={fRole}
            onChange={(e) => setFRole(e.target.value)}
            aria-label="役割で絞り込み"
            className="rounded border border-neutral-300 px-2 py-1.5"
          >
            <option value="">すべての役割</option>
            {[...roleChoices].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {filtersOn && (
            <button
              type="button"
              onClick={() => {
                setMyOnly(false);
                setFMember("");
                setFRole("");
                setFDate("");
              }}
              className="text-neutral-500 underline"
            >
              絞り込みを解除
            </button>
          )}
        </div>
      </div>

      {mode === "table" ? (
        <ShiftTable
          items={items}
          roleOrder={roles.map((r) => r.name)}
          title={instanceName}
          onMove={isAdmin ? moveAssignment : undefined}
          refreshing={refreshing}
          roleColors={roleColors}
          // The table's "+" has no time of its own: it gets the next full hour.
          onAdd={
            isAdmin
              ? (initial) =>
                  setForm({
                    shiftId: null,
                    initial: initial.start ? initial : { ...initial, start: newShiftInitial().start },
                  })
              : undefined
          }
          onEdit={
            isAdmin
              ? (shiftId) => {
                  const shift = shifts.find((s) => s.id === shiftId);
                  if (shift) openEdit(shift);
                }
              : undefined
          }
        />
      ) : (
        <>
          {[...groups.entries()].map(([dateKey, list]) => (
            <section key={dateKey} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-neutral-700">{dateLabel(dateKey)}</h2>
              {list.map(({ shift, assignments }) => {
                const ended = new Date(shift.endsAt).getTime() < nowMs;
                const mine = shift.assignments.some((a) => a.isMe);
                return (
                  <div
                    key={shift.id}
                    className={`rounded-lg border bg-white p-3 shadow-sm ${
                      mine ? "border-blue-300" : "border-neutral-200"
                    } ${ended ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold tabular-nums text-neutral-800">
                        {timeRange(shift)}
                        {mine && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            あなたのシフト
                          </span>
                        )}
                      </span>
                      {isAdmin && (
                        <span className="flex items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => setForm({ shiftId: null, initial: initialOf(shift) })}
                            className="text-neutral-600 hover:underline"
                          >
                            同じ時間で追加
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(shift)}
                            className="text-blue-600 hover:underline"
                          >
                            編集
                          </button>
                          <button type="button" onClick={() => setDeleting(shift)} className="text-red-600 hover:underline">
                            削除
                          </button>
                        </span>
                      )}
                    </div>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {[...assignments]
                        .sort((a, b) => roleRank(a.role) - roleRank(b.role))
                        .map((a) => (
                          <li key={`${a.memberId}-${a.role}`} className="flex flex-wrap items-center gap-2 text-sm">
                            <Avatar name={a.name} image={a.image} size={24} />
                            <span className={a.isMe ? "font-semibold text-neutral-900" : "text-neutral-700"}>{a.name}</span>
                            {a.unapproved && (
                              <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">
                                未承認ユーザー
                              </span>
                            )}
                            <span className={`rounded px-1.5 py-0.5 text-xs ${roleColor(a.role, roleColors)}`}>{a.role}</span>
                          </li>
                      ))}
                      {assignments.length === 0 && <li className="text-xs text-neutral-400">担当者が未設定です</li>}
                    </ul>
                  </div>
                );
              })}
            </section>
          ))}
          {groups.size === 0 && (
            <p className="text-sm text-neutral-400">
              {filtersOn ? "条件に合うシフトがありません" : "シフトはまだありません"}
            </p>
          )}
        </>
      )}

      {form && (
        <ShiftFormModal
          instanceId={instanceId}
          shiftId={form.shiftId}
          initial={form.initial}
          members={members}
          roles={roles}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            router.refresh();
          }}
        />
      )}
      {managingRoles && (
        <RolesModal instanceId={instanceId} roles={roles} onClose={() => setManagingRoles(false)} onChanged={() => router.refresh()} />
      )}
      {deleting && (
        <ConfirmModal
          title="シフトを削除"
          message={`${dateLabel(dateOf(deleting))} ${timeRange(deleting)} のシフトを削除しますか？`}
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
