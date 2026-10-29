"use client";

import { useState } from "react";
import { MAX_ROLE_LENGTH } from "@/lib/shifts";
import { roleColor, type RoleOption } from "./shiftTypes";

// Admin: register / remove the roles the shift form offers for this instance.
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shifts/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "登録に失敗しました");
        return;
      }
      setName("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(role: RoleOption) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "削除に失敗しました");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl">
        <h2 className="text-base font-semibold text-neutral-800">役割の登録</h2>
        <p className="text-xs text-neutral-500">
          このインスタンスのシフトで選べる役割です。削除しても、すでに設定済みのシフトの役割は変わりません。
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

        <ul className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <li
              key={role.id}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm ${roleColor(role.name)}`}
            >
              {role.name}
              <button
                type="button"
                onClick={() => remove(role)}
                disabled={busy}
                aria-label={`${role.name}を削除`}
                className="opacity-60 hover:opacity-100 disabled:opacity-30"
              >
                ✕
              </button>
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
