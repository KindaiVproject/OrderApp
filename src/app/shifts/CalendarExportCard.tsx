"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// "Add my shifts to the calendar": saves an .ics (POST /api/calendar/export)
// that Google Calendar / iPhone / Android can import. Used for all of my shifts
// (no instanceId) and for one instance's view (instanceId). Counts are per
// shift, since each shift is one calendar event.
export default function CalendarExportCard({
  upcomingCount,
  unregisteredCount,
  instanceId,
}: {
  upcomingCount: number;
  unregisteredCount: number;
  // Limits the export to my shifts in this instance.
  instanceId?: string;
}) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (upcomingCount === 0) return null;

  // Downloads the file and lets the calendar app import it. The server marks the
  // shifts as added, so "未登録" shrinks (router.refresh) the next time.
  async function addToCalendar(scope: "unregistered" | "all") {
    setExporting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/calendar/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, instanceId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "書き出しに失敗しました");
        return;
      }
      const count = res.headers.get("X-Event-Count");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "shifts.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage(
        `${count ?? ""}件のシフトのカレンダーファイル(shifts.ics)を保存しました。開いて、お使いのカレンダーに取り込んでください。`,
      );
      router.refresh();
    } catch {
      setError("書き出しに失敗しました。通信を確認してもう一度お試しください");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => addToCalendar("unregistered")}
          disabled={exporting || unregisteredCount === 0}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {unregisteredCount > 0
            ? `未登録の${unregisteredCount}件をカレンダーに追加`
            : "すべてカレンダーに追加済み"}
        </button>
        <button
          type="button"
          onClick={() => addToCalendar("all")}
          disabled={exporting}
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {instanceId ? "このインスタンスの" : ""}今後の{upcomingCount}件をすべて書き出す
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-neutral-500">
        {instanceId ? "このインスタンスの自分のシフトを、" : ""}
        カレンダーファイル(.ics)に保存します。開くとGoogleカレンダー・iPhone・Androidなどに取り込めます。同じシフトをもう一度取り込んでも、重複せずに更新されます。時間や役割が変わったシフトは、また「未登録」に戻ります。
      </p>
      {message && <p className="text-xs text-green-700">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
