"use client";

import Link from "next/link";
import { useState } from "react";
import Avatar from "@/components/Avatar";

export type Person = {
  email: string;
  // null = invited but never signed in
  userId: string | null;
  googleName: string | null;
  displayName: string | null;
  image: string | null;
  isAdmin: boolean;
  // Browsers/devices with shift notifications turned on
  devices: number;
  reminder30: boolean | null;
  memberships: {
    instanceId: string;
    instanceName: string;
    active: boolean;
    isInstanceAdmin: boolean;
    memberName: string | null;
  }[];
};

type Status = "all" | "signedIn" | "pending" | "admin";

// Same priority as everywhere else, minus the per-instance names: the person's
// own name, then their Google name, then the address.
const nameOf = (p: Person) => p.displayName ?? p.googleName ?? p.email;

export default function UsersClient({
  initialPeople,
  instances,
}: {
  initialPeople: Person[];
  instances: { id: string; name: string }[];
}) {
  const [people, setPeople] = useState(initialPeople);
  const [query, setQuery] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = query.trim().toLowerCase();
  const shown = people
    .filter((p) => {
      if (q && !`${nameOf(p)} ${p.googleName ?? ""} ${p.email}`.toLowerCase().includes(q)) return false;
      if (instanceId && !p.memberships.some((m) => m.instanceId === instanceId)) return false;
      if (status === "signedIn" && !p.userId) return false;
      if (status === "pending" && p.userId) return false;
      if (status === "admin" && !p.isAdmin) return false;
      return true;
    })
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), "ja"));

  const signedIn = people.filter((p) => p.userId).length;

  async function saveName(p: Person) {
    if (!p.userId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${p.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      setPeople((prev) => prev.map((x) => (x.email === p.email ? { ...x, displayName: data.displayName } : x)));
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-neutral-800">全ユーザー情報(Admin)</h1>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/admin" className="text-neutral-500 underline">
            インスタンス管理へ
          </Link>
          <Link href="/instances" className="text-neutral-500 underline">
            トップへ
          </Link>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        全インスタンスのメンバーを、アカウントごとにまとめて表示します。全{people.length}人(ログイン済み{" "}
        {signedIn}人 / 未承認 {people.length - signedIn}人)。
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・メールアドレスで検索"
          className="min-w-0 basis-full rounded border border-neutral-300 px-2 py-1.5 text-sm sm:basis-0 sm:flex-1"
        />
        <select
          value={instanceId}
          onChange={(e) => setInstanceId(e.target.value)}
          aria-label="インスタンスで絞り込み"
          className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
        >
          <option value="">すべてのインスタンス</option>
          {instances.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          aria-label="状態で絞り込み"
          className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
        >
          <option value="all">すべて</option>
          <option value="signedIn">ログイン済み</option>
          <option value="pending">未承認(未ログイン)</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="flex flex-col gap-2">
        {shown.map((p) => (
          <li key={p.email} className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <Avatar name={nameOf(p)} image={p.image} size={36} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {editing === p.email ? (
                    <>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={p.googleName ?? p.email}
                        maxLength={30}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveName(p);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                      />
                      <button type="button" onClick={() => saveName(p)} disabled={busy} className="text-xs text-blue-600 hover:underline">
                        保存
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="text-xs text-neutral-500 hover:underline">
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="truncate text-sm font-semibold text-neutral-800">{nameOf(p)}</span>
                      {p.userId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(p.email);
                            setDraft(p.displayName ?? "");
                            setError(null);
                          }}
                          aria-label={`${nameOf(p)}の表示名を編集`}
                          className="text-xs text-neutral-400 hover:text-neutral-700"
                        >
                          ✎
                        </button>
                      )}
                    </>
                  )}
                  {p.isAdmin && (
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-bold text-white">Admin</span>
                  )}
                  {p.userId ? (
                    <span className="rounded bg-green-100 px-1 py-0.5 text-[9px] font-bold text-green-700">ログイン済み</span>
                  ) : (
                    <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">未承認(未ログイン)</span>
                  )}
                </div>
                <span className="truncate text-xs text-neutral-500">{p.email}</span>
                {p.googleName && p.displayName && p.googleName !== p.displayName && (
                  <span className="text-[11px] text-neutral-400">Googleの名前: {p.googleName}</span>
                )}

                <div className="mt-1 flex flex-wrap gap-1.5">
                  {p.memberships.map((m) => (
                    <span
                      key={m.instanceId}
                      title={m.memberName ? `このインスタンスでの名前: ${m.memberName}` : undefined}
                      className={`rounded border px-1.5 py-0.5 text-[11px] ${
                        m.active ? "border-neutral-300 bg-neutral-50 text-neutral-700" : "border-neutral-200 bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      {m.instanceName}
                      {m.isInstanceAdmin ? "(管理者)" : ""}
                      {m.active ? "" : "(停止中)"}
                      {m.memberName ? ` / ${m.memberName}` : ""}
                    </span>
                  ))}
                  {p.memberships.length === 0 && <span className="text-[11px] text-neutral-400">どのインスタンスにも参加していません</span>}
                </div>

                {p.userId && (
                  <span className="text-[11px] text-neutral-500">
                    通知: {p.devices > 0 ? `${p.devices}台でオン` : "オフ"}
                    {p.devices > 0 && p.reminder30 !== null ? `(30分前の通知: ${p.reminder30 ? "あり" : "なし"})` : ""}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
        {shown.length === 0 && <p className="text-sm text-neutral-400">条件に合うユーザーがいません</p>}
      </ul>
    </div>
  );
}
