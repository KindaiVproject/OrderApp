"use client";

import { useState } from "react";
import { MAX_ROLE_LENGTH } from "@/lib/shifts";
import { roleColor, type RoleOption } from "./shiftTypes";

// Admin: register, rename, reorder and remove the roles the shift form offers
// for this instance. The order is the display priority (top of the schedule
// table, first in the pick-list).
export default function RolesModal({
  instanceId,
  roles,
  onClose,
  onChanged,
}: {
  instanceId: string;
  roles: RoleOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // One request at a time; surfaces the server's message on failure.
  async function call(url: string, init: RequestInit, failure: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? failure);
        return false;
      }
      onChanged();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (await call("/api/shifts/roles", { method: "POST", body: JSON.stringify({ instanceId, name }) }, "登録に失敗しました")) {
      setName("");
    }
  }

  async function saveRename(role: RoleOption) {
    if (!draft.trim() || draft.trim() === role.name) {
      setEditingId(null);
      return;
    }
    if (await call(`/api/shifts/roles/${role.id}`, { method: "PATCH", body: JSON.stringify({ name: draft }) }, "変更に失敗しました")) {
      setEditingId(null);
    }
  }

  function move(index: number, delta: -1 | 1) {
    const ids = roles.map((r) => r.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    call("/api/shifts/roles/reorder", { method: "POST", body: JSON.stringify({ instanceId, ids }) }, "並び替えに失敗しました");
  }

  const iconButton =
    "flex h-7 w-7 items-center justify-center rounded border border-neutral-300 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl">
        <h2 className="text-base font-semibold text-neutral-800">役割の設定</h2>
        <p className="text-xs leading-relaxed text-neutral-500">
          このインスタンスのシフトで選べる役割です。上にあるほど優先して表示します(シフト表の行、選択肢の順)。名前を変えると、設定済みのシフトの役割も一緒に変わります。削除しても、設定済みのシフトの役割は変わりません。
        </p>

        <form onSubmit={add} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="役割名(例: レジ)"
            maxLength={MAX_ROLE_LENGTH}
            className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            追加
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <ul className="flex flex-col gap-1.5">
          {roles.map((role, i) => (
            <li key={role.id} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 p-1.5">
              {editingId === role.id ? (
                <>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={MAX_ROLE_LENGTH}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(role);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <button type="button" onClick={() => saveRename(role)} disabled={busy} className="px-1 text-xs text-blue-600 hover:underline">
                    保存
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="px-1 text-xs text-neutral-500 hover:underline">
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-sm ${roleColor(role.name)}`}>{role.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(role.id);
                      setDraft(role.name);
                    }}
                    disabled={busy}
                    aria-label={`${role.name}の名前を変更`}
                    className={iconButton}
                  >
                    ✎
                  </button>
                  <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={`${role.name}を上へ`} className={iconButton}>
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={busy || i === roles.length - 1}
                    aria-label={`${role.name}を下へ`}
                    className={iconButton}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      call(`/api/shifts/roles/${role.id}`, { method: "DELETE" }, "削除に失敗しました")
                    }
                    disabled={busy}
                    aria-label={`${role.name}を削除`}
                    className={`${iconButton} hover:text-red-600`}
                  >
                    ✕
                  </button>
                </>
              )}
            </li>
          ))}
          {roles.length === 0 && <li className="text-xs text-neutral-400">まだ役割がありません</li>}
        </ul>

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-neutral-600">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
