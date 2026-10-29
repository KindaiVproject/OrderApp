"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Avatar from "@/components/Avatar";

const MAX_LENGTH = 30;

export default function AccountClient({
  email,
  googleName,
  image,
  initialDisplayName,
}: {
  email: string;
  googleName: string | null;
  image: string | null;
  initialDisplayName: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saved, setSaved] = useState(initialDisplayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(false);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      const next = data.displayName ?? "";
      setDisplayName(next);
      setSaved(next);
      setNotice(true);
    } finally {
      setSaving(false);
    }
  }

  const shownName = saved || googleName || email;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-neutral-800">アカウント設定</h1>
        <button type="button" onClick={() => router.back()} className="text-xs text-neutral-500 underline">
          戻る
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <Avatar name={shownName} image={image} size={48} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-neutral-800">{shownName}</span>
          <span className="truncate text-xs text-neutral-500">{email}</span>
        </div>
      </div>

      <form
        onSubmit={save}
        className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          表示名
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={googleName ?? "未設定"}
            maxLength={MAX_LENGTH}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <p className="text-[11px] leading-relaxed text-neutral-500">
          メンバー一覧などに表示される名前です。空にするとGoogleアカウントの名前
          {googleName ? `(${googleName})` : ""}が使われます。管理者がインスタンスごとに名前を設定している場合は、そちらが優先されます。
        </p>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || displayName.trim() === saved}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            保存
          </button>
          {notice && <span className="text-xs text-green-600">保存しました</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
