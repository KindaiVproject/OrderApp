"use client";

import { useRouter } from "next/navigation";

// Chooses what /shifts shows: my shifts across every instance, or one
// instance's full shift view. A select scales to any number of instances.
export default function ShiftScopeSwitcher({
  instances,
  value,
}: {
  instances: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-600">
      表示するシフト
      <select
        value={value}
        onChange={(e) => router.push(e.target.value ? `/shifts?instance=${e.target.value}` : "/shifts")}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm"
      >
        <option value="">全インスタンスの自分のシフト</option>
        {instances.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}のシフト
          </option>
        ))}
      </select>
    </label>
  );
}
