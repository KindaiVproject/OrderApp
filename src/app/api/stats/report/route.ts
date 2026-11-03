import { getCurrentInstance } from "@/lib/instance";
import { getOrderStats } from "@/lib/stats";
import { reportFileName, reportMeta } from "@/lib/statsReport";
import { buildStatsPdf } from "@/lib/statsPdf";
import { buildStatsXlsx } from "@/lib/statsXlsx";

const TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

// The statistics report as a PDF or an Excel file: ?format=pdf|xlsx and
// optionally &day=YYYY-MM-DD for one day (default: the whole period).
export async function GET(request: Request) {
  const instance = await getCurrentInstance();
  if (!instance) return new Response("unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  if (format !== "pdf" && format !== "xlsx") return new Response("format must be pdf or xlsx", { status: 400 });
  const dayParam = params.get("day");
  const day = dayParam && dayParam !== "all" ? dayParam : null;
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Response("invalid day", { status: 400 });

  const stats = await getOrderStats(instance.id, day ?? undefined);
  const meta = reportMeta(instance.name, day);
  const body = format === "pdf" ? await buildStatsPdf(stats, meta) : await buildStatsXlsx(stats, meta);

  const filename = reportFileName(meta, format);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": TYPES[format],
      "Content-Disposition": `attachment; filename="report.${format}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
