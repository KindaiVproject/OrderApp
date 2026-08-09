"use client";

import { useMemo, useState } from "react";
import BarChart, { type BarDatum } from "@/components/BarChart";
import { formatJstDateShort } from "@/lib/datetime";
import type { DailyTotal } from "@/lib/stats";

export default function StatsClient({
  dailyTotals,
  hourlyByDay,
}: {
  dailyTotals: DailyTotal[];
  hourlyByDay: Record<string, number[]>;
}) {
  const days = useMemo(() => dailyTotals.map((d) => d.date), [dailyTotals]);
  const [selectedDay, setSelectedDay] = useState(days[days.length - 1] ?? "");
  const [showDailyTable, setShowDailyTable] = useState(false);
  const [showHourlyTable, setShowHourlyTable] = useState(false);

  const dailyBars: BarDatum[] = dailyTotals.map((d) => ({
    label: formatJstDateShort(d.date),
    value: d.total,
    tooltipTitle: `${formatJstDateShort(d.date)}(${d.count}件)`,
  }));

  const grandTotal = dailyTotals.reduce((sum, d) => sum + d.total, 0);

  const hourlyBars: BarDatum[] = useMemo(() => {
    const hours = hourlyByDay[selectedDay] ?? [];
    let firstActive = hours.findIndex((v) => v > 0);
    let lastActive = hours.length - 1 - [...hours].reverse().findIndex((v) => v > 0);
    if (firstActive === -1) {
      firstActive = 9;
      lastActive = 18;
    }
    // Pad a little around the active window so bars near the edge aren't
    // flush against the chart border.
    const start = Math.max(0, firstActive - 1);
    const end = Math.min(23, lastActive + 1);
    return hours.slice(start, end + 1).map((total, i) => {
      const hour = start + i;
      return {
        label: `${hour}時`,
        value: total,
        tooltipTitle: `${hour}:00〜${hour + 1}:00`,
      };
    });
  }, [hourlyByDay, selectedDay]);

  const selectedDayTotal = dailyTotals.find((d) => d.date === selectedDay)?.total ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-base font-semibold text-neutral-800">売上統計</h1>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">全日の推移</h2>
          <span className="text-xs text-neutral-500">
            合計 <span className="font-semibold text-neutral-800">{grandTotal.toLocaleString("ja-JP")}円</span>
          </span>
        </div>
        {dailyTotals.length === 0 ? (
          <p className="text-sm text-neutral-400">まだ売上データがありません</p>
        ) : (
          <>
            <BarChart data={dailyBars} />
            <button
              type="button"
              onClick={() => setShowDailyTable((v) => !v)}
              className="self-start text-xs text-neutral-500 underline"
            >
              {showDailyTable ? "表を隠す" : "表で見る"}
            </button>
            {showDailyTable && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-neutral-500">
                    <th className="py-1 font-medium">日付</th>
                    <th className="py-1 font-medium">件数</th>
                    <th className="py-1 font-medium">売上</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyTotals.map((d) => (
                    <tr key={d.date} className="border-t border-neutral-100">
                      <td className="py-1">{d.date}</td>
                      <td className="py-1">{d.count}件</td>
                      <td className="py-1">{d.total.toLocaleString("ja-JP")}円</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">日別の推移(時間帯別)</h2>
          {days.length > 0 && (
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="rounded border border-neutral-300 px-2 py-1 text-xs"
            >
              {days.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          )}
        </div>
        {days.length === 0 ? (
          <p className="text-sm text-neutral-400">まだ売上データがありません</p>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              この日の合計 <span className="font-semibold text-neutral-800">{selectedDayTotal.toLocaleString("ja-JP")}円</span>
            </p>
            <BarChart data={hourlyBars} />
            <button
              type="button"
              onClick={() => setShowHourlyTable((v) => !v)}
              className="self-start text-xs text-neutral-500 underline"
            >
              {showHourlyTable ? "表を隠す" : "表で見る"}
            </button>
            {showHourlyTable && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-neutral-500">
                    <th className="py-1 font-medium">時間帯</th>
                    <th className="py-1 font-medium">売上</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlyBars.map((b) => (
                    <tr key={b.label} className="border-t border-neutral-100">
                      <td className="py-1">{b.tooltipTitle}</td>
                      <td className="py-1">{b.value.toLocaleString("ja-JP")}円</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
