"use client";

import { useState } from "react";
import { parseEmailList } from "@/lib/emails";
import { memberDisplayName, type MemberWithUser } from "@/lib/memberName";

export default function MembersClient({
  instanceId,
  initialMembers,
  currentEmail,
}: {
  instanceId: string;
  initialMembers: MemberWithUser[];
  currentEmail: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [inviteText, setInviteText] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const emails = parseEmailList(inviteText);
    if (emails.length === 0) return;
    setError(null);
    setInviting(true);
    try {
      const results = await Promise.all(
        emails.map(async (email) => {
          const res = await fetch(`/api/admin/instances/${instanceId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await res.json().catch(() => ({}));
          return { email, ok: res.ok, data };
        }),
      );

      const succeeded = results.filter((r) => r.ok).map((r) => r.data as MemberWithUser);
      if (succeeded.length > 0) {
        setMembers((prev) => [...prev, ...succeeded.filter((m) => !prev.some((x) => x.id === m.id))]);
      }
      const failed = results.filter((r) => !r.ok);
      setInviteText(failed.map((f) => f.email).join(", "));
      if (failed.length > 0) setError(`招待に失敗: ${failed.map((f) => f.email).join(", ")}`);
    } finally {
      setInviting(false);
    }
  }

  async function toggleInstanceAdmin(member: MemberWithUser) {
    setError(null);
    const res = await fetch(`/api/admin/instances/${instanceId}/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isInstanceAdmin: !member.isInstanceAdmin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "権限の変更に失敗しました");
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === member.id ? data : m)));
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-base font-semibold text-neutral-800">メンバー管理</h1>
      <p className="text-xs text-neutral-500">
        このインスタンスにメンバーを招待し、インスタンス管理者の権限を付与できます。インスタンス管理者は編集履歴も閲覧できます。
      </p>

      <form
        onSubmit={invite}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
      >
        <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-600">
          招待するGoogleアカウントのメール(複数可: カンマ・スペース区切り)
          <input
            value={inviteText}
            onChange={(e) => setInviteText(e.target.value)}
            placeholder="例: a@gmail.com, b@gmail.com"
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={inviting}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          招待
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="flex flex-col gap-2">
        {members.map((member) => {
          const isSelf = member.email === currentEmail;
          return (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
            >
              <div className="flex min-w-0 flex-col text-sm text-neutral-700">
                <span className="flex items-center gap-1">
                  {memberDisplayName(member)}
                  {isSelf && <span className="text-xs text-neutral-400">(自分)</span>}
                  {member.userId && (
                    <span className="rounded bg-green-100 px-1 py-0.5 text-[9px] font-bold text-green-700">
                      認証済み
                    </span>
                  )}
                </span>
                {memberDisplayName(member) !== member.email && (
                  <span className="text-xs text-neutral-400">{member.email}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-neutral-400">権限</span>
                <button
                  type="button"
                  onClick={() => toggleInstanceAdmin(member)}
                  disabled={isSelf}
                  title={isSelf ? "自分自身の権限は変更できません" : undefined}
                  className={`rounded px-2 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                    member.isInstanceAdmin ? "bg-blue-100 text-blue-700" : "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  {member.isInstanceAdmin ? "インスタンス管理者" : "一般"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
