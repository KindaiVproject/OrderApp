import { formatJstDateTime } from "@/lib/datetime";
import type { getOrderStats } from "@/lib/stats";

// Shared by the Excel and PDF statistics reports.
export type ReportStats = Awaited<ReturnType<typeof getOrderStats>>;

export type ReportMeta = {
  instanceName: string;
  // One day ("YYYY-MM-DD") or null for the whole period.
  day: string | null;
  generatedAt: string;
};

export function reportMeta(instanceName: string, day: string | null): ReportMeta {
  return { instanceName, day, generatedAt: formatJstDateTime(new Date()) };
}

// "全期間(2026-11-03〜2026-11-05)" / "2026-11-03"
export function periodLabel(stats: ReportStats, day: string | null): string {
  if (day) return day;
  const days = stats.dailyTotals.map((d) => d.date);
  if (days.length === 0) return "全期間";
  return days.length === 1 ? `全期間(${days[0]})` : `全期間(${days[0]}〜${days[days.length - 1]})`;
}

export function summarize(stats: ReportStats) {
  const total = stats.dailyTotals.reduce((s, d) => s + d.total, 0);
  const count = stats.dailyTotals.reduce((s, d) => s + d.count, 0);
  const quantity = stats.dailyTotals.reduce((s, d) => s + d.quantity, 0);
  return { total, count, quantity, average: count > 0 ? Math.round(total / count) : 0 };
}

// The hours worth showing: from the first to the last hour with any sales on
// any of the days (a default window when there are none).
export function activeHours(stats: ReportStats): number[] {
  let first = 24;
  let last = -1;
  for (const hours of Object.values(stats.hourlyByDay)) {
    hours.forEach((v, h) => {
      if (v > 0) {
        first = Math.min(first, h);
        last = Math.max(last, h);
      }
    });
  }
  if (last === -1) {
    first = 9;
    last = 18;
  }
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

export function reportFileName(meta: ReportMeta, ext: "pdf" | "xlsx"): string {
  const part = meta.day ?? "全期間";
  return `統計レポート_${meta.instanceName}_${part}.${ext}`.replace(/[\\/:*?"<>|]/g, "_");
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}
