import ExcelJS from "exceljs";
import { activeHours, periodLabel, summarize, type ReportMeta, type ReportStats } from "@/lib/statsReport";

// The Excel statistics report: a summary sheet plus one sheet per breakdown.
// Totals and shares are real formulas (with their values stored too), so the
// sheets keep working if someone edits a number.

const FONT = "Yu Gothic";
const INK = "FF262626";
const MUTED = "FF737373";
const ACCENT = "FF2A78D6";
const HEADER_FILL = "FF262626";
const BAND_FILL = "FFF5F5F5";
const METHOD_COLORS: Record<string, string> = { CASH: "FF2A78D6", PAYPAY: "FFE11D48", D_PAYMENT: "FFEA580C", UNKNOWN: "FF737373" };

const YEN = '#,##0"円"';
const COUNT = '#,##0"件"';
const QTY = '#,##0"個"';
const PCT = "0.0%";

type Sheet = ExcelJS.Worksheet;

function newSheet(wb: ExcelJS.Workbook, name: string, title: string, meta: ReportMeta, stats: ReportStats, widths: number[], landscape: boolean): Sheet {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: landscape ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      printTitlesRow: "4:4",
    },
    headerFooter: { oddFooter: `&L${meta.instanceName}&C&P / &N&R${meta.generatedAt}` },
  });
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { name: FONT, size: 16, bold: true, color: { argb: INK } };
  ws.getRow(1).height = 26;
  ws.getCell("A2").value = `${meta.instanceName} / ${periodLabel(stats, meta.day)}`;
  ws.getCell("A2").font = { name: FONT, size: 10, color: { argb: MUTED } };
  return ws;
}

function headerRow(ws: Sheet, rowNumber: number, labels: string[]) {
  const row = ws.getRow(rowNumber);
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1);
    cell.value = label;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
  });
  row.height = 20;
}

function styleBody(ws: Sheet, from: number, to: number, cols: number, formats: (string | null)[]) {
  for (let r = from; r <= to; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.font = { ...cell.font, name: FONT, size: 10 };
      if (formats[c - 1]) cell.numFmt = formats[c - 1]!;
      cell.border = { bottom: { style: "thin", color: { argb: "FFE5E5E5" } } };
      if ((r - from) % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND_FILL } };
    }
  }
}

function totalRow(ws: Sheet, rowNumber: number, cols: number, formats: (string | null)[]) {
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getRow(rowNumber).getCell(c);
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: INK } };
    if (formats[c - 1]) cell.numFmt = formats[c - 1]!;
    cell.border = { top: { style: "medium", color: { argb: INK } } };
  }
}

function dataBar(ws: Sheet, ref: string, color = ACCENT) {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "dataBar",
        priority: 1,
        minLength: 0,
        maxLength: 100,
        gradient: false,
        showValue: true,
        cfvo: [{ type: "num", value: 0 }, { type: "max" }],
        color: { argb: color },
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });
}

function heatmap(ws: Sheet, ref: string) {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "colorScale",
        priority: 1,
        cfvo: [{ type: "num", value: 0 }, { type: "max" }],
        color: [{ argb: "FFFFFFFF" }, { argb: "FF7FB2F0" }],
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });
}

function col(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

export async function buildStatsXlsx(stats: ReportStats, meta: ReportMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OrderApp";
  wb.created = new Date();
  const sum = summarize(stats);
  const methods = stats.byPayment;
  const days = stats.dailyTotals.map((d) => d.date);

  // Created first so it is the first tab; filled in at the end, once the other sheets' totals are known.
  const ws = wb.addWorksheet("サマリー", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: `&L${meta.instanceName}&R${meta.generatedAt}` },
  });

  // ---- 日別 ----
  const daily = newSheet(wb, "日別", "日別の売上", meta, stats, [14, 10, 10, 14, 14, ...methods.map(() => 14)], true);
  headerRow(daily, 4, ["日付", "件数", "個数", "売上", "1件あたり", ...methods.map((m) => m.label)]);
  const dailyFormats = [null, COUNT, QTY, YEN, YEN, ...methods.map(() => YEN)];
  stats.dailyTotals.forEach((d, i) => {
    const r = 5 + i;
    const row = daily.getRow(r);
    row.getCell(1).value = d.date;
    row.getCell(2).value = d.count;
    row.getCell(3).value = d.quantity;
    row.getCell(4).value = d.total;
    row.getCell(5).value = { formula: `IF(B${r}=0,0,ROUND(D${r}/B${r},0))`, result: d.count > 0 ? Math.round(d.total / d.count) : 0 };
    const byMethod = stats.dailyByPayment.find((p) => p.date === d.date)?.totals ?? {};
    methods.forEach((m, j) => (row.getCell(6 + j).value = byMethod[m.method] ?? 0));
  });
  const dFirst = 5;
  const dLast = 4 + days.length;
  const dTotal = dLast + 1;
  styleBody(daily, dFirst, dLast, 5 + methods.length, dailyFormats);
  if (days.length > 0) {
    const t = daily.getRow(dTotal);
    t.getCell(1).value = "合計";
    t.getCell(2).value = { formula: `SUM(B${dFirst}:B${dLast})`, result: sum.count };
    t.getCell(3).value = { formula: `SUM(C${dFirst}:C${dLast})`, result: sum.quantity };
    t.getCell(4).value = { formula: `SUM(D${dFirst}:D${dLast})`, result: sum.total };
    t.getCell(5).value = { formula: `IF(B${dTotal}=0,0,ROUND(D${dTotal}/B${dTotal},0))`, result: sum.average };
    methods.forEach((m, j) => {
      const letter = col(6 + j);
      t.getCell(6 + j).value = { formula: `SUM(${letter}${dFirst}:${letter}${dLast})`, result: m.total };
    });
    totalRow(daily, dTotal, 5 + methods.length, dailyFormats);
    dataBar(daily, `D${dFirst}:D${dLast}`);
  } else {
    daily.getCell("A5").value = "売上データがありません";
  }

  // ---- 時間帯別 ----
  const hours = activeHours(stats);
  const hourly = newSheet(wb, "時間帯別", "時間帯別の売上", meta, stats, [16, ...days.map(() => 14), 14], true);
  headerRow(hourly, 4, ["時間帯", ...days, "合計"]);
  const hourlyFormats = [null, ...days.map(() => YEN), YEN];
  hours.forEach((h, i) => {
    const r = 5 + i;
    const row = hourly.getRow(r);
    row.getCell(1).value = `${h}:00〜${h + 1}:00`;
    let rowSum = 0;
    days.forEach((d, j) => {
      const v = stats.hourlyByDay[d]?.[h] ?? 0;
      rowSum += v;
      row.getCell(2 + j).value = v;
    });
    const last = col(1 + days.length);
    row.getCell(2 + days.length).value = { formula: days.length > 0 ? `SUM(B${r}:${last}${r})` : "0", result: rowSum };
  });
  const hLast = 4 + hours.length;
  styleBody(hourly, 5, hLast, 2 + days.length, hourlyFormats);
  if (days.length > 0) {
    const t = hourly.getRow(hLast + 1);
    t.getCell(1).value = "合計";
    for (let j = 0; j <= days.length; j++) {
      const letter = col(2 + j);
      let colSum = 0;
      for (const h of hours) {
        colSum += j < days.length ? (stats.hourlyByDay[days[j]]?.[h] ?? 0) : days.reduce((s, d) => s + (stats.hourlyByDay[d]?.[h] ?? 0), 0);
      }
      t.getCell(2 + j).value = { formula: `SUM(${letter}5:${letter}${hLast})`, result: colSum };
    }
    totalRow(hourly, hLast + 1, 2 + days.length, hourlyFormats);
    heatmap(hourly, `B5:${col(1 + days.length)}${hLast}`);
  } else {
    hourly.getCell("A5").value = "売上データがありません";
  }

  // ---- 決済手段別 ----
  const pay = newSheet(wb, "決済手段別", "決済手段別の売上", meta, stats, [16, 14, 10, 10, 10, 14], false);
  headerRow(pay, 4, ["決済手段", "売上", "割合", "件数", "個数", "1件あたり"]);
  const payFormats = [null, YEN, PCT, COUNT, QTY, YEN];
  methods.forEach((m, i) => {
    const r = 5 + i;
    const row = pay.getRow(r);
    row.getCell(1).value = m.label;
    row.getCell(1).font = { name: FONT, size: 10, bold: true, color: { argb: METHOD_COLORS[m.method] ?? INK } };
    row.getCell(2).value = m.total;
    row.getCell(3).value = { formula: `IF(B$${5 + methods.length}=0,0,B${r}/B$${5 + methods.length})`, result: sum.total > 0 ? m.total / sum.total : 0 };
    row.getCell(4).value = m.count;
    row.getCell(5).value = m.quantity;
    row.getCell(6).value = { formula: `IF(D${r}=0,0,ROUND(B${r}/D${r},0))`, result: m.count > 0 ? Math.round(m.total / m.count) : 0 };
  });
  const pLast = 4 + methods.length;
  const pTotal = pLast + 1;
  styleBody(pay, 5, pLast, 6, payFormats);
  methods.forEach((m, i) => {
    pay.getRow(5 + i).getCell(1).font = { name: FONT, size: 10, bold: true, color: { argb: METHOD_COLORS[m.method] ?? INK } };
  });
  const pt = pay.getRow(pTotal);
  pt.getCell(1).value = "合計";
  pt.getCell(2).value = { formula: `SUM(B5:B${pLast})`, result: sum.total };
  pt.getCell(3).value = { formula: `SUM(C5:C${pLast})`, result: sum.total > 0 ? 1 : 0 };
  pt.getCell(4).value = { formula: `SUM(D5:D${pLast})`, result: sum.count };
  pt.getCell(5).value = { formula: `SUM(E5:E${pLast})`, result: sum.quantity };
  pt.getCell(6).value = { formula: `IF(D${pTotal}=0,0,ROUND(B${pTotal}/D${pTotal},0))`, result: sum.average };
  totalRow(pay, pTotal, 6, payFormats);
  dataBar(pay, `B5:B${pLast}`);

  if (days.length > 1) {
    const top = pTotal + 3;
    pay.getCell(`A${top - 1}`).value = "日別の内訳";
    pay.getCell(`A${top - 1}`).font = { name: FONT, size: 11, bold: true, color: { argb: INK } };
    headerRow(pay, top, ["日付", ...methods.map((m) => m.label), "合計"]);
    const matrixFormats = [null, ...methods.map(() => YEN), YEN];
    days.forEach((d, i) => {
      const r = top + 1 + i;
      const row = pay.getRow(r);
      row.getCell(1).value = d;
      const byMethod = stats.dailyByPayment.find((p) => p.date === d)?.totals ?? {};
      let rowSum = 0;
      methods.forEach((m, j) => {
        const v = byMethod[m.method] ?? 0;
        rowSum += v;
        row.getCell(2 + j).value = v;
      });
      row.getCell(2 + methods.length).value = { formula: `SUM(B${r}:${col(1 + methods.length)}${r})`, result: rowSum };
    });
    styleBody(pay, top + 1, top + days.length, 2 + methods.length, matrixFormats);
  }

  // ---- 商品別 ----
  const prod = newSheet(wb, "商品別", "商品別の売上", meta, stats, [8, 28, 14, 10, 10, 12, 10, ...days.map(() => 11)], true);
  headerRow(prod, 4, ["順位", "商品名", "売上", "割合", "個数", "平均単価", "注文数", ...days.map((d) => `${d}(個)`)]);
  const prodFormats = [null, null, YEN, PCT, QTY, YEN, COUNT, ...days.map(() => QTY)];
  const products = stats.byProduct;
  products.forEach((p, i) => {
    const r = 5 + i;
    const row = prod.getRow(r);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = p.name;
    row.getCell(3).value = p.total;
    row.getCell(4).value = { formula: `IF(C$${5 + products.length}=0,0,C${r}/C$${5 + products.length})`, result: percentOf(p.total, productSum(products)) };
    row.getCell(5).value = p.quantity;
    row.getCell(6).value = { formula: `IF(E${r}=0,0,ROUND(C${r}/E${r},0))`, result: p.quantity > 0 ? Math.round(p.total / p.quantity) : 0 };
    row.getCell(7).value = p.orders;
    days.forEach((d, j) => (row.getCell(8 + j).value = stats.productByDay[d]?.[p.name]?.quantity ?? 0));
  });
  const prLast = 4 + products.length;
  styleBody(prod, 5, prLast, 7 + days.length, prodFormats);
  if (products.length > 0) {
    const r = prLast + 1;
    const t = prod.getRow(r);
    t.getCell(2).value = "合計";
    t.getCell(3).value = { formula: `SUM(C5:C${prLast})`, result: productSum(products) };
    t.getCell(4).value = { formula: `SUM(D5:D${prLast})`, result: 1 };
    t.getCell(5).value = { formula: `SUM(E5:E${prLast})`, result: products.reduce((s, p) => s + p.quantity, 0) };
    t.getCell(6).value = { formula: `IF(E${r}=0,0,ROUND(C${r}/E${r},0))`, result: Math.round(productSum(products) / Math.max(1, products.reduce((s, p) => s + p.quantity, 0))) };
    days.forEach((d, j) => {
      const letter = col(8 + j);
      t.getCell(8 + j).value = { formula: `SUM(${letter}5:${letter}${prLast})`, result: products.reduce((s, p) => s + (stats.productByDay[d]?.[p.name]?.quantity ?? 0), 0) };
    });
    totalRow(prod, r, 7 + days.length, prodFormats);
    dataBar(prod, `C5:C${prLast}`);
    prod.getCell(`A${r + 2}`).value = "※ 0円の商品(廃棄・検食など)は含みません。";
    prod.getCell(`A${r + 2}`).font = { name: FONT, size: 9, color: { argb: MUTED } };
  } else {
    prod.getCell("A5").value = "売上データがありません";
  }

  // ---- サマリー ----
  [16, 16, 16, 16, 16, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = "売上統計レポート";
  ws.getCell("A1").font = { name: FONT, size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  ws.getCell("A1").alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 40;
  const info: [string, string][] = [
    ["インスタンス", meta.instanceName],
    ["対象", periodLabel(stats, meta.day)],
    ["出力日時", `${meta.generatedAt}(日本時間)`],
  ];
  info.forEach(([k, v], i) => {
    const r = 3 + i;
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { name: FONT, size: 10, color: { argb: MUTED } };
    ws.mergeCells(`B${r}:F${r}`);
    ws.getCell(`B${r}`).value = v;
    ws.getCell(`B${r}`).font = { name: FONT, size: 10, bold: true, color: { argb: INK } };
  });

  // KPI tiles: label row + big value row, two columns each.
  const kpis: { label: string; value: ExcelJS.CellValue; fmt: string }[] = [
    { label: "総売上", value: days.length > 0 ? { formula: `'日別'!D${dTotal}`, result: sum.total } : 0, fmt: YEN },
    { label: "注文件数", value: days.length > 0 ? { formula: `'日別'!B${dTotal}`, result: sum.count } : 0, fmt: COUNT },
    { label: "販売個数", value: days.length > 0 ? { formula: `'日別'!C${dTotal}`, result: sum.quantity } : 0, fmt: QTY },
  ];
  kpis.forEach((k, i) => {
    const c1 = col(1 + i * 2);
    const c2 = col(2 + i * 2);
    ws.mergeCells(`${c1}7:${c2}7`);
    ws.mergeCells(`${c1}8:${c2}8`);
    ws.getCell(`${c1}7`).value = k.label;
    ws.getCell(`${c1}7`).font = { name: FONT, size: 10, color: { argb: MUTED } };
    ws.getCell(`${c1}7`).alignment = { horizontal: "center" };
    ws.getCell(`${c1}8`).value = k.value;
    ws.getCell(`${c1}8`).numFmt = k.fmt;
    ws.getCell(`${c1}8`).font = { name: FONT, size: 18, bold: true, color: { argb: INK } };
    ws.getCell(`${c1}8`).alignment = { horizontal: "center", vertical: "middle" };
    for (const c of [c1, c2]) {
      for (const r of [7, 8]) {
        ws.getCell(`${c}${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND_FILL } };
      }
    }
  });
  ws.getRow(8).height = 32;
  ws.getCell("A9").value = "客単価(1件あたり)";
  ws.getCell("A9").font = { name: FONT, size: 10, color: { argb: MUTED } };
  ws.mergeCells("B9:C9");
  ws.getCell("B9").value = days.length > 0 ? { formula: `'日別'!E${dTotal}`, result: sum.average } : 0;
  ws.getCell("B9").numFmt = YEN;
  ws.getCell("B9").font = { name: FONT, size: 11, bold: true, color: { argb: INK } };
  ws.getCell("B9").alignment = { horizontal: "left" };

  ws.getCell("A11").value = "決済手段別";
  ws.getCell("A11").font = { name: FONT, size: 12, bold: true, color: { argb: INK } };
  headerRow(ws, 12, ["決済手段", "売上", "割合", "件数", "個数", "1件あたり"]);
  methods.forEach((m, i) => {
    const r = 13 + i;
    const row = ws.getRow(r);
    row.getCell(1).value = m.label;
    row.getCell(2).value = { formula: `'決済手段別'!B${5 + i}`, result: m.total };
    row.getCell(3).value = { formula: `'決済手段別'!C${5 + i}`, result: percentOf(m.total, sum.total) };
    row.getCell(4).value = { formula: `'決済手段別'!D${5 + i}`, result: m.count };
    row.getCell(5).value = { formula: `'決済手段別'!E${5 + i}`, result: m.quantity };
    row.getCell(6).value = { formula: `'決済手段別'!F${5 + i}`, result: m.count > 0 ? Math.round(m.total / m.count) : 0 };
  });
  styleBody(ws, 13, 12 + methods.length, 6, payFormats);
  methods.forEach((m, i) => {
    ws.getRow(13 + i).getCell(1).font = { name: FONT, size: 10, bold: true, color: { argb: METHOD_COLORS[m.method] ?? INK } };
  });
  dataBar(ws, `B13:B${12 + methods.length}`);

  const topRow = 13 + methods.length + 2;
  ws.getCell(`A${topRow - 1}`).value = "売れた商品 上位5(売上順)";
  ws.getCell(`A${topRow - 1}`).font = { name: FONT, size: 12, bold: true, color: { argb: INK } };
  headerRow(ws, topRow, ["順位", "商品名", "売上", "割合", "個数", "平均単価"]);
  const top5 = products.slice(0, 5);
  top5.forEach((p, i) => {
    const r = topRow + 1 + i;
    const row = ws.getRow(r);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = p.name;
    row.getCell(3).value = { formula: `'商品別'!C${5 + i}`, result: p.total };
    row.getCell(4).value = { formula: `'商品別'!D${5 + i}`, result: percentOf(p.total, productSum(products)) };
    row.getCell(5).value = { formula: `'商品別'!E${5 + i}`, result: p.quantity };
    row.getCell(6).value = { formula: `'商品別'!F${5 + i}`, result: p.quantity > 0 ? Math.round(p.total / p.quantity) : 0 };
  });
  styleBody(ws, topRow + 1, topRow + top5.length, 6, [null, null, YEN, PCT, QTY, YEN]);
  if (top5.length === 0) ws.getCell(`A${topRow + 1}`).value = "売上データがありません";
  ws.getCell(`A${topRow + top5.length + 3}`).value = "詳細は各シートをご覧ください(日別・時間帯別・決済手段別・商品別)。キャンセルした注文は含みません。";
  ws.getCell(`A${topRow + top5.length + 3}`).font = { name: FONT, size: 9, color: { argb: MUTED } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function productSum(products: ReportStats["byProduct"]): number {
  return products.reduce((s, p) => s + p.total, 0);
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}
