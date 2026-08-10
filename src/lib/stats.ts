import { prisma } from "@/lib/prisma";
import { formatJstDateKey, getJstHour } from "@/lib/datetime";

export type DailyTotal = { date: string; total: number; count: number; quantity: number };
export type HourlyTotal = { hour: number; total: number };

export async function getOrderStats(instanceId: string) {
  // Cancelled orders never became a sale — same population as the CSV export.
  const orders = await prisma.order.findMany({
    where: { instanceId, status: { not: "CANCELLED" } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap = new Map<string, { total: number; count: number; quantity: number }>();
  const hourlyByDay = new Map<string, number[]>();

  for (const order of orders) {
    const total = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const dateKey = formatJstDateKey(order.createdAt);
    const hour = getJstHour(order.createdAt);

    const day = dailyMap.get(dateKey) ?? { total: 0, count: 0, quantity: 0 };
    day.total += total;
    day.count += 1;
    day.quantity += quantity;
    dailyMap.set(dateKey, day);

    const hours = hourlyByDay.get(dateKey) ?? new Array(24).fill(0);
    hours[hour] += total;
    hourlyByDay.set(dateKey, hours);
  }

  const dailyTotals: DailyTotal[] = Array.from(dailyMap.entries())
    .map(([date, { total, count, quantity }]) => ({ date, total, count, quantity }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const hourlyByDayObj: Record<string, number[]> = {};
  for (const [date, hours] of hourlyByDay) hourlyByDayObj[date] = hours;

  return { dailyTotals, hourlyByDay: hourlyByDayObj };
}
