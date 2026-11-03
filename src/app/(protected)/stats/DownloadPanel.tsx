"use client";

import { useState } from "react";

const BUTTON = "rounded-lg bg-neutral-900 px-3 py-1.5 text-center text-xs font-medium text-white";

// The statistics report (PDF/Excel) and the sales-data CSVs, side by side in an
// accordion that starts closed.
export default function DownloadPanel({ days }: { days: string[] }) {
  const [open, setOpen] = useState(false);
  // The report covers "all" or one day; 各日程CSV one day (the latest to begin with).
  const [reportDay, setReportDay] = useState("all");
  const [csvDay, setCsvDay] = useState(days[days.length - 1] ?? "");

  const selectClass = "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span className="text-sm font-semibold text-neutral-700">データをダウンロード</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        (days.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-neutral-400">まだ売上データがありません</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-3 pb-3">
            <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-2.5">
              <span className="text-xs font-semibold text-neutral-700">統計レポート</span>
              <select
                value={reportDay}
                onChange={(e) => setReportDay(e.target.value)}
                aria-label="レポートの対象"
                className={selectClass}
              >
                <option value="all">全期間</option>
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <a href={`/api/stats/report?format=pdf&day=${reportDay}`} download className={BUTTON}>
                PDFで保存
              </a>
              <a href={`/api/stats/report?format=xlsx&day=${reportDay}`} download className={BUTTON}>
                Excelで保存
              </a>
            </div>

            <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-2.5">
              <span className="text-xs font-semibold text-neutral-700">売上データCSV</span>
              <select
                value={csvDay}
                onChange={(e) => setCsvDay(e.target.value)}
                aria-label="各日程CSVにする日"
                className={selectClass}
              >
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <a href={`/api/orders/export?day=${csvDay}`} download className={BUTTON}>
                各日程CSVで保存
              </a>
              <a href="/api/orders/export" download className={BUTTON}>
                全日程CSVで保存
              </a>
            </div>
          </div>
        ))}
    </div>
  );
}
