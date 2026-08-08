"use client";

import Link from "next/link";
import { useState } from "react";
import type { InstanceModel, InstanceMemberModel } from "@generated/prisma/models";

type InstanceWithMembers = InstanceModel & { members: InstanceMemberModel[] };

export default function AdminClient({ initialInstances }: { initialInstances: InstanceWithMembers[] }) {
  const [instances, setInstances] = useState(initialInstances);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});

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
    const email = (inviteEmail[instanceId] ?? "").trim();
    if (!email) return;
    const res = await fetch(`/api/admin/instances/${instanceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setInstances((prev) =>
        prev.map((i) => (i.id === instanceId ? { ...i, members: [...i.members, data] } : i)),
      );
      setInviteEmail((prev) => ({ ...prev, [instanceId]: "" }));
    }
  }

  async function deleteInstance(instance: InstanceWithMembers) {
    const typed = window.prompt(
      `本当に「${instance.name}」を削除しますか？\n` +
        "商品・注文履歴(売上データ)もすべて完全に削除され、元に戻せません。\n" +
        "削除するには、インスタンス名を正確に入力してください。",
    );
    if (typed === null) return;
    if (typed !== instance.name) {
      alert("インスタンス名が一致しないため、削除を中止しました");
      return;
    }
    const res = await fetch(`/api/admin/instances/${instance.id}`, { method: "DELETE" });
    if (res.ok) {
      setInstances((prev) => prev.filter((i) => i.id !== instance.id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "削除に失敗しました");
    }
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-neutral-800">インスタンス管理(Admin)</h1>
        <Link href="/instances" className="text-xs text-neutral-500 underline">
          インスタンス選択へ
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
                  onClick={() => deleteInstance(instance)}
                  className="rounded px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            </div>

            <ul className="mt-2 flex flex-col gap-1">
              {instance.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between text-xs text-neutral-600">
                  <span>{member.email}</span>
                  <button
                    type="button"
                    onClick={() => removeMember(instance.id, member.id)}
                    className="text-red-500 hover:underline"
                  >
                    削除
                  </button>
                </li>
              ))}
              {instance.members.length === 0 && (
                <li className="text-xs text-neutral-400">メンバーがいません</li>
              )}
            </ul>

            <div className="mt-2 flex gap-2">
              <input
                value={inviteEmail[instance.id] ?? ""}
                onChange={(e) => setInviteEmail((prev) => ({ ...prev, [instance.id]: e.target.value }))}
                placeholder="招待するGoogleアカウントのメール"
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
          </li>
        ))}
        {instances.length === 0 && <p className="text-sm text-neutral-400">インスタンスがありません</p>}
      </ul>
    </div>
  );
}
