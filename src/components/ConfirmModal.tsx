"use client";

import { useState } from "react";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "削除する",
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "処理に失敗しました");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-4">
        <h2 className={`text-sm font-semibold ${danger ? "text-red-700" : "text-neutral-800"}`}>{title}</h2>
        <p className="text-sm text-neutral-600">{message}</p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-neutral-500">
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`rounded px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40 ${
              danger ? "bg-red-600" : "bg-neutral-900"
            }`}
          >
            {busy ? "処理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
