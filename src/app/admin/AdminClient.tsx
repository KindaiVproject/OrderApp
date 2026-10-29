"use client";

import Link from "next/link";
import { useState } from "react";
import type { InstanceModel, AdminInviteModel } from "@generated/prisma/models";
import ConfirmModal from "@/components/ConfirmModal";
import { parseEmailList } from "@/lib/emails";
import Avatar from "@/components/Avatar";
import { JOB_STALE_MINUTES } from "@/lib/jobs";
import { memberDisplayName, resolveName, type MemberWithUser } from "@/lib/memberName";

type NotifyJobStatus = {
  configured: boolean;
  ranMinutesAgo: number | null;
  checked: number;
  sent: number;
};

type InstanceWithMembers = InstanceModel & { members: MemberWithUser[] };

export default function AdminClient({
  initialInstances,
  initialAdminInvites,
  bootstrapAdminEmail,
  adminProfiles,
  notifyJob,
}: {
  initialInstances: InstanceWithMembers[];
  initialAdminInvites: AdminInviteModel[];
  bootstrapAdminEmail: string;
  adminProfiles: Record<string, { name: string | null; image: string | null }>;
  notifyJob: NotifyJobStatus;
}) {
  const [instances, setInstances] = useState(initialInstances);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [inviteError, setInviteError] = useState<Record<string, string | null>>({});
  const [deletingInstance, setDeletingInstance] = useState<InstanceWithMembers | null>(null);
  const [duplicatingInstance, setDuplicatingInstance] = useState<InstanceWithMembers | null>(null);
  const [adminInvites, setAdminInvites] = useState(initialAdminInvites);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [removingAdmin, setRemovingAdmin] = useState<AdminInviteModel | null>(null);
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(new Set());
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState("");

  function toggleExpanded(instanceId: string) {
    setExpandedInstances((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  }

  function startEditingDisplayName(member: MemberWithUser) {
    setEditingMemberId(member.id);
    setEditingDisplayName(member.displayName ?? "");
  }

  async function saveDisplayName(instanceId: string, memberId: string) {
    const res = await fetch(`/api/admin/instances/${instanceId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: editingDisplayName.trim() || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setInstances((prev) =>
        prev.map((i) =>
          i.id === instanceId ? { ...i, members: i.members.map((m) => (m.id === memberId ? data : m)) } : i,
        ),
      );
      setEditingMemberId(null);
    }
  }

  async function createInstance(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("インスタンス名を入力してください");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "作成に失敗しました");
      setInstances((prev) => [...prev, data]);
      setName("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(instance: InstanceWithMembers) {
    const res = await fetch(`/api/admin/instances/${instance.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !instance.active }),
    });
    const data = await res.json();
    if (res.ok) {
      setInstances((prev) => prev.map((i) => (i.id === instance.id ? { ...i, active: data.active } : i)));
    }
  }

  async function invite(instanceId: string) {
    const emails = parseEmailList(inviteEmail[instanceId] ?? "");
    if (emails.length === 0) return;
    setInviteError((prev) => ({ ...prev, [instanceId]: null }));

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

    const succeeded = results.filter((r) => r.ok).map((r) => r.data);
    if (succeeded.length > 0) {
      setInstances((prev) =>
        prev.map((i) => {
          if (i.id !== instanceId) return i;
          const newOnes = succeeded.filter((m) => !i.members.some((x) => x.id === m.id));
          return { ...i, members: [...i.members, ...newOnes] };
        }),
      );
    }

    const failed = results.filter((r) => !r.ok);
    setInviteEmail((prev) => ({ ...prev, [instanceId]: failed.map((f) => f.email).join(", ") }));
    setInviteError((prev) => ({
      ...prev,
      [instanceId]: failed.length > 0 ? `招待に失敗: ${failed.map((f) => f.email).join(", ")}` : null,
    }));
  }

  async function removeMember(instanceId: string, memberId: string) {
    const res = await fetch(`/api/admin/instances/${instanceId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setInstances((prev) =>
        prev.map((i) =>
          i.id === instanceId ? { ...i, members: i.members.filter((m) => m.id !== memberId) } : i,
        ),
      );
    }
  }

  async function toggleInstanceAdmin(instanceId: string, member: MemberWithUser) {
    const res = await fetch(`/api/admin/instances/${instanceId}/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isInstanceAdmin: !member.isInstanceAdmin }),
    });
    const data = await res.json();
    if (res.ok) {
      setInstances((prev) =>
        prev.map((i) =>
          i.id === instanceId
            ? { ...i, members: i.members.map((m) => (m.id === member.id ? data : m)) }
            : i,
        ),
      );
    }
  }

  async function inviteAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);
    const emails = parseEmailList(newAdminEmail);
    if (emails.length === 0) return;

    const results = await Promise.all(
      emails.map(async (email) => {
        const res = await fetch("/api/admin/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json().catch(() => ({}));
        return { email, ok: res.ok, data };
      }),
    );

    const succeeded = results.filter((r) => r.ok).map((r) => r.data);
    if (succeeded.length > 0) {
      setAdminInvites((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        return [...prev, ...succeeded.filter((s) => !existingIds.has(s.id))];
      });
    }

    const failed = results.filter((r) => !r.ok);
    setNewAdminEmail(failed.map((f) => f.email).join(", "));
    setAdminError(failed.length > 0 ? `招待に失敗: ${failed.map((f) => f.email).join(", ")}` : null);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-neutral-800">インスタンス管理(Admin)</h1>
        <Link href="/instances" className="text-xs text-neutral-500 underline">
          トップへ
        </Link>
      </div>

      <form onSubmit={createInstance} className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          インスタンス名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: たこ焼き店"
            className="w-40 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          ラベル(ヘッダー表示/任意)
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例: vpro"
            className="w-32 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          作成
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="flex flex-col gap-3">
        {instances.map((instance) => (
          <li key={instance.id} className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-neutral-800">{instance.name}</span>
                {instance.label && <span className="ml-1 text-xs text-neutral-400">({instance.label})</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(instance)}
                  className={`rounded px-2 py-1 text-[10px] font-bold ${
                    instance.active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  {instance.active ? "稼働中" : "停止中"}
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicatingInstance(instance)}
                  className="rounded px-2 py-1 text-[10px] font-bold text-neutral-600 hover:bg-neutral-100"
                >
                  複製
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingInstance(instance)}
                  className="rounded px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleExpanded(instance.id)}
              className="mt-2 flex w-full items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
            >
              <span className={`transition-transform ${expandedInstances.has(instance.id) ? "rotate-90" : ""}`}>
                ▶
              </span>
              メンバー ({instance.members.length})
            </button>

            {expandedInstances.has(instance.id) && (
              <>
                <div className="mt-2 flex gap-2">
                  <input
                    value={inviteEmail[instance.id] ?? ""}
                    onChange={(e) => setInviteEmail((prev) => ({ ...prev, [instance.id]: e.target.value }))}
                    placeholder="招待するGoogleアカウントのメール(複数可: カンマ・スペース区切り)"
                    className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => invite(instance.id)}
                    className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white"
                  >
                    招待
                  </button>
                </div>
                {inviteError[instance.id] && (
                  <p className="mt-1 text-xs text-red-600">{inviteError[instance.id]}</p>
                )}
                <ul className="mt-2 flex flex-col gap-2">
                  {instance.members.map((member) => (
                    <li key={member.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
                      <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <Avatar name={memberDisplayName(member)} image={member.user?.image} size={28} />
                        <div className="min-w-0 flex-1">
                          {editingMemberId === member.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={editingDisplayName}
                                onChange={(e) => setEditingDisplayName(e.target.value)}
                                placeholder={resolveName(member.email, null, member.user)}
                                autoFocus
                                className="flex-1 rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => saveDisplayName(instance.id, member.id)}
                                className="text-blue-600 hover:underline"
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingMemberId(null)}
                                className="text-neutral-400 hover:underline"
                              >
                                キャンセル
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditingDisplayName(member)}
                              className="flex flex-col items-start text-left hover:underline"
                            >
                              <span className="flex items-center gap-1">
                                {memberDisplayName(member)}
                                {member.userId && (
                                  <span className="rounded bg-green-100 px-1 py-0.5 text-[9px] font-bold text-green-700">
                                    認証済み
                                  </span>
                                )}
                              </span>
                              {memberDisplayName(member) !== member.email && (
                                <span className="text-[10px] text-neutral-400">{member.email}</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-end gap-3 border-t border-neutral-200 pt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-neutral-400">権限</span>
                          <button
                            type="button"
                            onClick={() => toggleInstanceAdmin(instance.id, member)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              member.isInstanceAdmin
                                ? "bg-blue-100 text-blue-700"
                                : "bg-neutral-200 text-neutral-500"
                            }`}
                          >
                            {member.isInstanceAdmin ? "インスタンス管理者" : "一般"}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(instance.id, member.id)}
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold text-red-600 hover:bg-red-50"
                        >
                          このメンバーを削除
                        </button>
                      </div>
                    </li>
                  ))}
                  {instance.members.length === 0 && (
                    <li className="text-xs text-neutral-400">メンバーがいません</li>
                  )}
                </ul>
              </>
            )}
          </li>
        ))}
        {instances.length === 0 && <p className="text-sm text-neutral-400">インスタンスがありません</p>}
      </ul>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-800">管理者(Admin)</h2>

        <form
          onSubmit={inviteAdmin}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
        >
          <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-600">
            招待するGoogleアカウントのメール(複数可: カンマ・スペース区切り)
            <input
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="例: a@gmail.com, b@gmail.com"
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            管理者に招待
          </button>
        </form>
        {adminError && <p className="text-sm text-red-600">{adminError}</p>}

        <ul className="flex flex-col gap-2">
          <li className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-sm">
            <AdminLabel email={bootstrapAdminEmail} profile={adminProfiles[bootstrapAdminEmail]} />
            <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600">
              常時管理者
            </span>
          </li>
          {adminInvites
            .filter((invite) => invite.email !== bootstrapAdminEmail)
            .map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-sm"
              >
                <AdminLabel email={invite.email} profile={adminProfiles[invite.email]} />
                <button
                  type="button"
                  onClick={() => setRemovingAdmin(invite)}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  権限を削除
                </button>
              </li>
            ))}
        </ul>
      </div>

      <NotifyJobCard job={notifyJob} />

      {removingAdmin && (
        <ConfirmModal
          title="管理者権限を削除"
          message={`${removingAdmin.email} のインスタンス管理権限を削除しますか？`}
          onClose={() => setRemovingAdmin(null)}
          onConfirm={async () => {
            const res = await fetch(`/api/admin/admins/${removingAdmin.id}`, { method: "DELETE" });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error ?? "削除に失敗しました");
            }
            setAdminInvites((prev) => prev.filter((a) => a.id !== removingAdmin.id));
            setRemovingAdmin(null);
          }}
        />
      )}

      {deletingInstance && (
        <DeleteInstanceModal
          instance={deletingInstance}
          onClose={() => setDeletingInstance(null)}
          onDeleted={(id) => {
            setInstances((prev) => prev.filter((i) => i.id !== id));
            setDeletingInstance(null);
          }}
        />
      )}

      {duplicatingInstance && (
        <DuplicateInstanceModal
          instance={duplicatingInstance}
          onClose={() => setDuplicatingInstance(null)}
          onDuplicated={(created) => {
            setInstances((prev) => [...prev, created]);
            setDuplicatingInstance(null);
          }}
        />
      )}
    </div>
  );
}

function DuplicateInstanceModal({
  instance,
  onClose,
  onDuplicated,
}: {
  instance: InstanceWithMembers;
  onClose: () => void;
  onDuplicated: (instance: InstanceWithMembers) => void;
}) {
  const [name, setName] = useState(`${instance.name} のコピー`);
  const [label, setLabel] = useState(instance.label);
  const [error, setError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  async function handleDuplicate() {
    if (!name.trim()) {
      setError("インスタンス名を入力してください");
      return;
    }
    setDuplicating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/instances/${instance.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "複製に失敗しました");
      onDuplicated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "複製に失敗しました");
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-800">インスタンスを複製</h2>
        <p className="text-sm text-neutral-600">
          「{instance.name}」の商品とメンバーを引き継いだ新しいインスタンスを作成します。注文履歴は引き継がれません。
        </p>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          新しいインスタンス名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          ラベル(ヘッダー表示/任意)
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-neutral-500">
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={duplicating}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {duplicating ? "複製中..." : "複製する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Is the external per-minute scheduler (cron-job.org) really reaching
// /api/cron/shift-notify? The route stamps a heartbeat on every authorized run.
function NotifyJobCard({ job }: { job: NotifyJobStatus }) {
  let tone = "border-green-200 bg-green-50 text-green-800";
  let text: string;
  if (!job.configured) {
    tone = "border-red-200 bg-red-50 text-red-700";
    text = "サーバーの設定が足りません(VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / CRON_SECRET を確認してください)";
  } else if (job.ranMinutesAgo === null) {
    tone = "border-red-200 bg-red-50 text-red-700";
    text =
      "一度も実行されていません。cron-job.org のジョブ(URL・Authorizationヘッダー)と、Vercel の Deployment Protection で /api/cron/ が弾かれていないかを確認してください";
  } else if (job.ranMinutesAgo > JOB_STALE_MINUTES) {
    tone = "border-red-200 bg-red-50 text-red-700";
    text = `最後の実行は${job.ranMinutesAgo}分前です。cron-job.org のジョブが止まっている可能性があります`;
  } else {
    text = `正常に実行されています(最終実行: ${job.ranMinutesAgo}分前 / 直近の対象 ${job.checked}件・送信 ${job.sent}件)`;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-base font-semibold text-neutral-800">シフト通知ジョブの状態</h2>
      <p className={`rounded-lg border p-3 text-xs leading-relaxed ${tone}`}>{text}</p>
    </div>
  );
}

function AdminLabel({
  email,
  profile,
}: {
  email: string;
  profile?: { name: string | null; image: string | null };
}) {
  const name = profile?.name;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={name ?? email} image={profile?.image} size={28} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-neutral-800">{name ?? email}</span>
        {name && <span className="truncate text-xs text-neutral-500">{email}</span>}
      </span>
    </span>
  );
}

function DeleteInstanceModal({
  instance,
  onClose,
  onDeleted,
}: {
  instance: InstanceWithMembers;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const matches = typed === instance.name;

  async function handleDelete() {
    if (!matches) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/instances/${instance.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "削除に失敗しました");
      }
      onDeleted(instance.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-4">
        <h2 className="text-sm font-semibold text-red-700">インスタンスを削除</h2>
        <p className="text-sm text-neutral-600">
          「{instance.name}」を削除します。商品・注文履歴(売上データ)もすべて完全に削除され、元に戻せません。
        </p>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          確認のため、インスタンス名「{instance.name}」を入力してください
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-neutral-500">
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!matches || deleting}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {deleting ? "削除中..." : "削除する"}
          </button>
        </div>
      </div>
    </div>
  );
}
