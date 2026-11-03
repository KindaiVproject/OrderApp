import fontkit from "@pdf-lib/fontkit";
import subsetFont from "subset-font";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { loadReportFonts } from "@/lib/reportFonts";
import { activeHours, percent, periodLabel, summarize, type ReportMeta, type ReportStats } from "@/lib/statsReport";

// The PDF statistics report: A4 portrait, a title band, headline figures, then
// a section per breakdown (決済手段別 / 日別 / 時間帯別 / 商品別) drawn as bars and
// tables, with page numbers in the footer.

const W = 595.28;
const H = 841.89;
const M = 40; // page margin
const CW = W - M * 2; // content width
const FOOTER_Y = 26;
const BOTTOM = 52; // lowest y the content may reach

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const INK = hex("#262626");
const MUTED = hex("#737373");
const LINE = hex("#e5e5e5");
const BAND = hex("#f5f5f5");
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const METHOD_COLORS: Record<string, string> = { CASH: "#2a78d6", PAYPAY: "#e11d48", D_PAYMENT: "#ea580c", UNKNOWN: "#737373" };

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
const pct = (f: number) => `${(f * 100).toFixed(1)}%`;

const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
const KANA =
  Array.from({ length: 0x3096 - 0x3041 + 1 }, (_, i) => String.fromCharCode(0x3041 + i)).join("") +
  Array.from({ length: 0x30fa - 0x30a1 + 1 }, (_, i) => String.fromCharCode(0x30a1 + i)).join("") +
  "ー・、。「」()〜…";
const STATIC_TEXT =
  "売上統計レポート対象出力総売上注文件数販売個数客単価1件あたり決済手段別日付合計日別の時間帯別全日の商品別" +
  "順位商品名割合平均単価円個件時0円の商品(廃棄・検食など)は含みません売上データがありません…/:〜%" +
  "現金/金券PayPayd払い全期間不明日ごとの決済手段売れ行き商品時間帯別売上上位5品縦軸は日ごと共通個数順";

type Align = "left" | "right" | "center";
type Column = { title: string; width: number; align?: Align };

class Report {
  pdf!: PDFDocument;
  regular!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  pages: PDFPage[] = [];
  y = 0;
  usedChars = new Set<string>();
  private warned = new Set<string>();

  constructor(
    private stats: ReportStats,
    private meta: ReportMeta,
  ) {}

  async init() {
    const fonts = await loadReportFonts();
    this.pdf = await PDFDocument.create();
    this.pdf.registerFontkit(fontkit);
    this.pdf.setTitle(`統計レポート ${this.meta.instanceName}`);
    this.pdf.setCreator("OrderApp");
    // pdf-lib's own subsetting drops glyphs of this font, so the font is cut
    // down to the characters this report uses first (everything printed is
    // either fixed text below or comes from the stats/meta objects), then
    // embedded whole: a few KB instead of several MB.
    const used = `${STATIC_TEXT}${ASCII}${KANA}${periodLabel(this.stats, this.meta.day)}${JSON.stringify(this.stats)}${JSON.stringify(this.meta)}`;
    this.usedChars = new Set(used);
    const cut = (font: Buffer) => subsetFont(font, used, { targetFormat: "truetype" });
    this.regular = await this.pdf.embedFont(await cut(fonts.regular), { subset: false });
    this.bold = await this.pdf.embedFont(await cut(fonts.bold), { subset: false });
  }

  newPage(withHeader: boolean) {
    this.page = this.pdf.addPage([W, H]);
    this.pages.push(this.page);
    this.y = H - M;
    if (withHeader) {
      // Slim running header on continuation pages.
      this.text(`売上統計レポート ${this.meta.instanceName}`, M, this.y - 8, { size: 8, color: MUTED });
      this.page.drawLine({ start: { x: M, y: this.y - 14 }, end: { x: W - M, y: this.y - 14 }, thickness: 0.5, color: LINE });
      this.y -= 28;
    }
  }

  // Starts a new page when `height` would not fit above the footer.
  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage(true);
  }

  fit(str: string, size: number, font: PDFFont, maxWidth: number): string {
    if (font.widthOfTextAtSize(str, size) <= maxWidth) return str;
    let s = str;
    while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxWidth) s = s.slice(0, -1);
    return `${s}…`;
  }

  text(str: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: Align; maxWidth?: number } = {}) {
    const size = o.size ?? 9;
    const font = o.bold ? this.bold : this.regular;
    // A character outside the cut-down font would print blank: say so in the logs.
    for (const ch of str) {
      if (!this.usedChars.has(ch) && !this.warned.has(ch)) {
        this.warned.add(ch);
        console.warn(`statsPdf: "${ch}" is not in the embedded font subset`);
      }
    }
    const value = o.maxWidth ? this.fit(str, size, font, o.maxWidth) : str;
    const w = font.widthOfTextAtSize(value, size);
    const px = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    this.page.drawText(value, { x: px, y, size, font, color: o.color ?? INK });
  }

  rect(x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
    if (w > 0 && h > 0) this.page.drawRectangle({ x, y, width: w, height: h, color });
  }

  title() {
    const { stats, meta } = this;
    this.rect(0, H - 92, W, 92, INK);
    this.text("売上統計レポート", M, H - 48, { size: 22, bold: true, color: rgb(1, 1, 1) });
    this.text(`${meta.instanceName}  /  対象: ${periodLabel(stats, meta.day)}  /  出力: ${meta.generatedAt}`, M, H - 70, {
      size: 9,
      color: rgb(0.85, 0.85, 0.85),
      maxWidth: CW,
    });
    this.y = H - 92 - 24;
  }

  kpis() {
    const sum = summarize(this.stats);
    const items = [
      ["総売上", yen(sum.total)],
      ["注文件数", `${sum.count.toLocaleString("ja-JP")}件`],
      ["販売個数", `${sum.quantity.toLocaleString("ja-JP")}個`],
      ["客単価(1件あたり)", yen(sum.average)],
    ];
    const gap = 10;
    const w = (CW - gap * 3) / 4;
    items.forEach(([label, value], i) => {
      const x = M + i * (w + gap);
      this.rect(x, this.y - 52, w, 52, BAND);
      this.text(label, x + 10, this.y - 17, { size: 8, color: MUTED, maxWidth: w - 20 });
      this.text(value, x + 10, this.y - 40, { size: 15, bold: true, maxWidth: w - 20 });
    });
    this.y -= 52 + 22;
  }

  section(title: string, note?: string) {
    this.ensure(70);
    this.text(title, M, this.y, { size: 12, bold: true });
    if (note) this.text(note, W - M, this.y, { size: 8, color: MUTED, align: "right" });
    this.page.drawLine({ start: { x: M, y: this.y - 6 }, end: { x: W - M, y: this.y - 6 }, thickness: 1, color: INK });
    this.y -= 22;
  }

  empty() {
    this.text("売上データがありません", M, this.y, { color: MUTED });
    this.y -= 24;
  }

  // Label + figures on one line, a bar underneath (width = fraction of the content width).
  barRows(rows: { label: string; right: string; fraction: number; color: string }[]) {
    for (const r of rows) {
      this.ensure(30);
      this.text(r.label, M, this.y, { size: 9, bold: true, maxWidth: CW * 0.45 });
      this.text(r.right, W - M, this.y, { size: 9, align: "right", maxWidth: CW * 0.55 });
      this.rect(M, this.y - 11, CW, 6, BAND);
      this.rect(M, this.y - 11, CW * Math.min(1, Math.max(0, r.fraction)), 6, hex(r.color));
      this.y -= 26;
    }
    this.y -= 8;
  }

  table(columns: Column[], rows: string[][], opts: { total?: string[]; bars?: { column: number; fractions: number[]; color: string } } = {}) {
    const rowH = 17;
    const header = () => {
      this.ensure(rowH * 2);
      this.rect(M, this.y - rowH + 4, CW, rowH, INK);
      let x = M;
      for (const c of columns) {
        const tx = c.align === "right" ? x + c.width - 6 : c.align === "center" ? x + c.width / 2 : x + 6;
        this.text(c.title, tx, this.y - 8, { size: 8, bold: true, color: rgb(1, 1, 1), align: c.align, maxWidth: c.width - 12 });
        x += c.width;
      }
      this.y -= rowH;
    };
    header();
    const drawRow = (cells: string[], index: number, bold: boolean, rule: boolean) => {
      if (this.y - rowH < BOTTOM) {
        this.newPage(true);
        header();
      }
      if (index % 2 === 1 && !bold) this.rect(M, this.y - rowH + 4, CW, rowH, BAND);
      if (rule) this.page.drawLine({ start: { x: M, y: this.y + 4 }, end: { x: W - M, y: this.y + 4 }, thickness: 1, color: INK });
      let x = M;
      columns.forEach((c, i) => {
        const bar = opts.bars?.column === i ? opts.bars.fractions[index] : undefined;
        if (bar !== undefined) {
          this.rect(x + 6, this.y - 8, (c.width - 12) * Math.min(1, bar), 5, hex(opts.bars!.color));
        } else {
          const tx = c.align === "right" ? x + c.width - 6 : c.align === "center" ? x + c.width / 2 : x + 6;
          this.text(cells[i] ?? "", tx, this.y - 8, { size: 8.5, bold, align: c.align, maxWidth: c.width - 12 });
        }
        x += c.width;
      });
      this.y -= rowH;
    };
    rows.forEach((r, i) => drawRow(r, i, false, false));
    if (opts.total) drawRow(opts.total, 0, true, true);
    this.y -= 14;
  }

  // A small heading above a run of cards.
  subhead(text: string, note?: string) {
    this.text(text, M, this.y, { size: 9, bold: true, color: MUTED });
    if (note) this.text(note, W - M, this.y, { size: 7.5, color: MUTED, align: "right" });
    this.y -= 14;
  }

  // One card per day, three across (each a third of the content width), going
  // down the page row by row. `draw` fills a card: (day, left x, top y, width).
  dayCards(days: string[], height: number, draw: (day: string, x: number, top: number, w: number) => void) {
    const gap = 10;
    const w = (CW - gap * 2) / 3;
    for (let i = 0; i < days.length; i += 3) {
      this.ensure(height + 10);
      days.slice(i, i + 3).forEach((day, j) => {
        const x = M + j * (w + gap);
        this.rect(x, this.y - height, w, height, BAND);
        draw(day, x, this.y, w);
      });
      this.y -= height + 10;
    }
    this.y -= 16;
  }

  // The date on the left and the day's sales on the right, at the top of a card.
  cardHead(day: string, total: number, x: number, top: number, w: number) {
    this.text(day, x + 8, top - 14, { size: 8, bold: true, maxWidth: w * 0.5 });
    this.text(yen(total), x + w - 8, top - 14, { size: 8, align: "right", maxWidth: w * 0.5 - 8 });
  }

  paymentSection() {
    const { stats } = this;
    const sum = summarize(stats);
    this.section("決済手段別");
    if (sum.count === 0) return this.empty();
    this.barRows(
      stats.byPayment.map((m) => ({
        label: m.label,
        right: `${yen(m.total)}  ${pct(percent(m.total, sum.total))}  ${m.count}件・${m.quantity.toLocaleString("ja-JP")}個  平均${yen(m.count > 0 ? Math.round(m.total / m.count) : 0)}`,
        fraction: percent(m.total, sum.total),
        color: METHOD_COLORS[m.method] ?? BLUE,
      })),
    );
    if (stats.dailyByPayment.length > 1) {
      const n = stats.byPayment.length;
      const first = 110;
      const rest = (CW - first) / (n + 1);
      this.table(
        [{ title: "日付", width: first }, ...stats.byPayment.map((m) => ({ title: m.label, width: rest, align: "right" as const })), { title: "合計", width: rest, align: "right" as const }],
        stats.dailyByPayment.map((d) => [
          d.date,
          ...stats.byPayment.map((m) => yen(d.totals[m.method] ?? 0)),
          yen(stats.byPayment.reduce((s, m) => s + (d.totals[m.method] ?? 0), 0)),
        ]),
        { total: ["合計", ...stats.byPayment.map((m) => yen(m.total)), yen(sum.total)] },
      );
      const rowH = 17;
      this.ensure(24 + stats.byPayment.length * rowH + 30);
      this.subhead("日ごとの決済手段");
      this.dayCards(
        stats.dailyByPayment.map((d) => d.date),
        26 + stats.byPayment.length * rowH,
        (day, x, top, w) => {
          const totals = stats.dailyByPayment.find((d) => d.date === day)?.totals ?? {};
          const dayTotal = stats.byPayment.reduce((s, m) => s + (totals[m.method] ?? 0), 0);
          this.cardHead(day, dayTotal, x, top, w);
          stats.byPayment.forEach((m, i) => {
            const v = totals[m.method] ?? 0;
            const ry = top - 30 - i * rowH;
            this.text(m.label, x + 8, ry, { size: 7, maxWidth: w * 0.45 });
            this.text(yen(v), x + w - 8, ry, { size: 7, align: "right", maxWidth: w * 0.5 - 8 });
            this.rect(x + 8, ry - 6, w - 16, 3, rgb(1, 1, 1));
            this.rect(x + 8, ry - 6, (w - 16) * percent(v, dayTotal), 3, hex(METHOD_COLORS[m.method] ?? BLUE));
          });
        },
      );
    }
  }

  dailySection() {
    const { stats } = this;
    if (stats.dailyTotals.length < 2) return; // a single day has nothing to compare
    const sum = summarize(stats);
    const max = Math.max(...stats.dailyTotals.map((d) => d.total));
    this.section("日別の売上");
    this.table(
      [
        { title: "日付", width: 90 },
        { title: "件数", width: 60, align: "right" },
        { title: "個数", width: 60, align: "right" },
        { title: "売上", width: 90, align: "right" },
        { title: "1件あたり", width: 80, align: "right" },
        { title: "", width: CW - 380 },
      ],
      stats.dailyTotals.map((d) => [d.date, `${d.count}件`, `${d.quantity.toLocaleString("ja-JP")}個`, yen(d.total), yen(d.count > 0 ? Math.round(d.total / d.count) : 0), ""]),
      {
        total: ["合計", `${sum.count}件`, `${sum.quantity.toLocaleString("ja-JP")}個`, yen(sum.total), yen(sum.average), ""],
        bars: { column: 5, fractions: stats.dailyTotals.map((d) => percent(d.total, max)), color: BLUE },
      },
    );
  }

  hourlySection() {
    const { stats } = this;
    const hours = activeHours(stats);
    const days = Object.keys(stats.hourlyByDay);
    const values = hours.map((h) => days.reduce((s, d) => s + (stats.hourlyByDay[d]?.[h] ?? 0), 0));
    this.section("時間帯別の売上", days.length > 1 ? "全日の合計" : undefined);
    if (values.every((v) => v === 0)) return this.empty();

    const chartH = 120;
    this.ensure(chartH + 50);
    const top = this.y;
    const base = top - chartH;
    const max = niceMax(Math.max(...values));
    for (let i = 0; i <= 4; i++) {
      const gy = base + (chartH * i) / 4;
      this.page.drawLine({ start: { x: M + 34, y: gy }, end: { x: W - M, y: gy }, thickness: 0.4, color: LINE });
      this.text((max * i / 4).toLocaleString("ja-JP"), M + 30, gy - 3, { size: 7, color: MUTED, align: "right" });
    }
    const slot = (CW - 34) / hours.length;
    hours.forEach((h, i) => {
      const bh = (values[i] / max) * chartH;
      const x = M + 34 + slot * i + slot * 0.15;
      this.rect(x, base, slot * 0.7, bh, hex(BLUE));
      this.text(`${h}時`, x + slot * 0.35, base - 11, { size: 7, color: MUTED, align: "center" });
      if (values[i] > 0 && slot > 24) this.text(values[i].toLocaleString("ja-JP"), x + slot * 0.35, base + bh + 3, { size: 6.5, align: "center" });
    });
    this.y = base - 30;

    if (days.length > 1) {
      // Same vertical scale on every card, so the days can be compared.
      const dayMax = niceMax(Math.max(...days.flatMap((d) => hours.map((h) => stats.hourlyByDay[d]?.[h] ?? 0))));
      this.ensure(100 + 30);
      this.subhead("日ごとの時間帯別売上", "縦軸は日ごと共通");
      this.dayCards(days, 96, (day, x, top, w) => {
        const dayValues = hours.map((h) => stats.hourlyByDay[day]?.[h] ?? 0);
        this.cardHead(day, dayValues.reduce((s, v) => s + v, 0), x, top, w);
        const chartH = 52;
        const cBase = top - 96 + 18;
        const slot = (w - 16) / hours.length;
        this.page.drawLine({ start: { x: x + 8, y: cBase }, end: { x: x + w - 8, y: cBase }, thickness: 0.4, color: LINE });
        hours.forEach((h, i) => {
          const bx = x + 8 + slot * i + slot * 0.15;
          this.rect(bx, cBase, slot * 0.7, (dayValues[i] / dayMax) * chartH, hex(BLUE));
          if (slot >= 9 || i % 2 === 0) this.text(`${h}`, bx + slot * 0.35, cBase - 9, { size: 6, color: MUTED, align: "center" });
        });
      });
    }
  }

  productSection() {
    const { stats } = this;
    const products = stats.byProduct;
    this.section("商品別の売上", "0円の商品(廃棄・検食など)は含みません");
    if (products.length === 0) return this.empty();
    const total = products.reduce((s, p) => s + p.total, 0);
    const qty = products.reduce((s, p) => s + p.quantity, 0);
    const max = Math.max(...products.map((p) => p.total));
    this.table(
      [
        { title: "順位", width: 36, align: "center" },
        { title: "商品名", width: 150 },
        { title: "売上", width: 80, align: "right" },
        { title: "割合", width: 50, align: "right" },
        { title: "個数", width: 56, align: "right" },
        { title: "平均単価", width: 60, align: "right" },
        { title: "", width: CW - 432 },
      ],
      products.map((p, i) => [`${i + 1}`, p.name, yen(p.total), pct(percent(p.total, total)), `${p.quantity.toLocaleString("ja-JP")}個`, yen(p.quantity > 0 ? Math.round(p.total / p.quantity) : 0), ""]),
      {
        total: ["", "合計", yen(total), "100%", `${qty.toLocaleString("ja-JP")}個`, "", ""],
        bars: { column: 6, fractions: products.map((p) => percent(p.total, max)), color: ORANGE },
      },
    );

    const days = stats.dailyTotals.map((d) => d.date);
    if (days.length > 1) {
      const TOP = 5;
      const rowH = 17;
      this.ensure(26 + TOP * rowH + 30);
      this.subhead("日ごとの売れ行き商品", `個数順の上位${TOP}品`);
      this.dayCards(days, 26 + TOP * rowH, (day, x, top, w) => {
        const all = Object.entries(stats.productByDay[day] ?? {})
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.quantity - a.quantity || b.total - a.total || a.name.localeCompare(b.name, "ja"));
        const sold = all.slice(0, TOP);
        this.cardHead(day, all.reduce((s, p) => s + p.total, 0), x, top, w);
        const dayMax = sold[0]?.quantity ?? 0;
        sold.forEach((p, i) => {
          const ry = top - 30 - i * rowH;
          this.text(p.name, x + 8, ry, { size: 7, maxWidth: w * 0.62 });
          this.text(`${p.quantity.toLocaleString("ja-JP")}個`, x + w - 8, ry, { size: 7, align: "right" });
          this.rect(x + 8, ry - 6, w - 16, 3, rgb(1, 1, 1));
          this.rect(x + 8, ry - 6, (w - 16) * percent(p.quantity, dayMax), 3, hex(ORANGE));
        });
        if (sold.length === 0) this.text("売上なし", x + 8, top - 30, { size: 7, color: MUTED });
      });
    }
  }

  footers() {
    const n = this.pages.length;
    this.pages.forEach((page, i) => {
      this.page = page;
      page.drawLine({ start: { x: M, y: FOOTER_Y + 12 }, end: { x: W - M, y: FOOTER_Y + 12 }, thickness: 0.4, color: LINE });
      this.text(`${this.meta.instanceName}  売上統計レポート`, M, FOOTER_Y, { size: 7.5, color: MUTED, maxWidth: CW * 0.6 });
      this.text(`${i + 1} / ${n}`, W - M, FOOTER_Y, { size: 7.5, color: MUTED, align: "right" });
    });
  }
}

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / magnitude;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * magnitude;
}

export async function buildStatsPdf(stats: ReportStats, meta: ReportMeta): Promise<Uint8Array> {
  const r = new Report(stats, meta);
  await r.init();
  r.newPage(false);
  r.title();
  r.kpis();
  r.paymentSection();
  r.dailySection();
  r.hourlySection();
  r.productSection();
  r.footers();
  return r.pdf.save();
}
