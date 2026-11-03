import type { ReportStats } from "@/lib/statsReport";

function csvEscape(value: string | number) {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// One row per day: orders, pieces and sales, then the sales of each payment
// method and the pieces sold of each product (0円 lines left out, as in the
// statistics). Every day carries every column, 0 where nothing was sold.
export function buildDailyStatsCsv(stats: ReportStats): string {
  const methods = stats.byPayment;
  const products = stats.byProduct;

  const header = [
    "日付",
    "注文数",
    "点数",
    "売上(円)",
    ...methods.map((m) => `売上:${m.label}(円)`),
    ...products.map((p) => `個数:${p.name}`),
  ];
  const rows = stats.dailyTotals.map((d) => {
    const byMethod = stats.dailyByPayment.find((x) => x.date === d.date)?.totals ?? {};
    const byProduct = stats.productByDay[d.date] ?? {};
    return [
      d.date,
      d.count,
      d.quantity,
      d.total,
      ...methods.map((m) => byMethod[m.method] ?? 0),
      ...products.map((p) => byProduct[p.name]?.quantity ?? 0),
    ];
  });

  const lines = [header, ...rows].map((r) => r.map(csvEscape).join(","));
  // BOM so Excel opens the Japanese headers correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
