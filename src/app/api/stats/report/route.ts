import { getCurrentInstance } from "@/lib/instance";
import { getOrderStats } from "@/lib/stats";
import { reportFileName, reportMeta } from "@/lib/statsReport";
import { buildStatsPdf } from "@/lib/statsPdf";
import { buildStatsXlsx } from "@/lib/statsXlsx";
import { buildDailyStatsCsv } from "@/lib/statsCsv";

const TYPES = {
  pdf: "application/pdf",
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

// The statistics report as a PDF or an Excel file, or the daily statistics as a
// CSV: ?format=pdf|xlsx|csv and optionally &day=YYYY-MM-DD for one day
// (default: the whole period).
export async function GET(request: Request) {
  const instance = await getCurrentInstance();
  if (!instance) return new Response("unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  if (format !== "pdf" && format !== "xlsx" && format !== "csv") {
    return new Response("format must be pdf, xlsx or csv", { status: 400 });
  }
  const dayParam = params.get("day");
  const day = dayParam && dayParam !== "all" ? dayParam : null;
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Response("invalid day", { status: 400 });

  const stats = await getOrderStats(instance.id, day ?? undefined);
  const meta = reportMeta(instance.name, day);
  const body =
    format === "pdf"
      ? await buildStatsPdf(stats, meta)
      : format === "xlsx"
        ? await buildStatsXlsx(stats, meta)
        : Buffer.from(buildDailyStatsCsv(stats), "utf-8");

  const filename = reportFileName(meta, format);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": TYPES[format],
      "Content-Disposition": `attachment; filename="report.${format}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
