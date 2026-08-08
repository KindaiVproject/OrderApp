"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InstanceModel } from "@generated/prisma/models";

export default function InstancePicker({ instances }: { instances: InstanceModel[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function select(instance: InstanceModel) {
    if (!instance.active) return;
    setError(null);
    setBusyId(instance.id);
    try {
      const res = await fetch("/api/instances/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: instance.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "選択に失敗しました");
      router.push("/order");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "選択に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  if (instances.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-500 shadow-sm">
        まだどのインスタンスにも招待されていません。管理者に招待を依頼してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {instances.map((instance) => (
        <button
          key={instance.id}
          type="button"
          disabled={!instance.active || busyId === instance.id}
          onClick={() => select(instance)}
          className={`flex items-center justify-between rounded-lg border p-3 text-left shadow-sm ${
            instance.active
              ? "border-neutral-200 bg-white hover:bg-neutral-50"
              : "cursor-not-allowed border-neutral-100 bg-neutral-50 opacity-50"
          }`}
        >
          <span>
            <span className="block text-sm font-medium text-neutral-800">{instance.name}</span>
            {instance.label && <span className="block text-xs text-neutral-400">{instance.label}</span>}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              instance.active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"
            }`}
          >
            {instance.active ? "稼働中" : "停止中"}
          </span>
        </button>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
