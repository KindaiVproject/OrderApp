import { prisma } from "@/lib/prisma";
import { formatJstDateKey, getJstHour } from "@/lib/datetime";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment";

export type DailyTotal = { date: string; total: number; count: number; quantity: number };
export type HourlyTotal = { hour: number; total: number };
export type PaymentTotal = { method: string; label: string; total: number; count: number; quantity: number };
export type ProductTotal = { name: string; total: number; quantity: number; orders: number };
export type PaymentDaily = { date: string; totals: Record<string, number> };

export async function getOrderStats(instanceId: string) {
  // Cancelled orders never became a sale — same population as the CSV export.
  const orders = await prisma.order.findMany({
    where: { instanceId, status: { not: "CANCELLED" } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap = new Map<string, { total: number; count: number; quantity: number }>();
  const hourlyByDay = new Map<string, number[]>();
  const byPayment: PaymentTotal[] = PAYMENT_METHOD_OPTIONS.map(({ value, label }) => ({
    method: value,
    label,
    total: 0,
    count: 0,
    quantity: 0,
  }));
  const paymentByDay = new Map<string, Record<string, number>>();
  // Per product name (the name snapshot on the order line, so renamed or
  // deleted products still count). Free lines (0円: 廃棄・検食 etc.) are left out.
  const productMap = new Map<string, ProductTotal>();

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

    for (const item of order.items) {
      if (item.unitPrice === 0) continue;
      const p = productMap.get(item.productName) ?? { name: item.productName, total: 0, quantity: 0, orders: 0 };
      p.total += item.unitPrice * item.quantity;
      p.quantity += item.quantity;
      p.orders += 1;
      productMap.set(item.productName, p);
    }

    const method = byPayment.find((p) => p.method === order.paymentMethod);
    if (method) {
      method.total += total;
      method.count += 1;
      method.quantity += quantity;
    }
    const dayPayments = paymentByDay.get(dateKey) ?? {};
    dayPayments[order.paymentMethod] = (dayPayments[order.paymentMethod] ?? 0) + total;
    paymentByDay.set(dateKey, dayPayments);

    const hours = hourlyByDay.get(dateKey) ?? new Array(24).fill(0);
    hours[hour] += total;
    hourlyByDay.set(dateKey, hours);
  }

  const dailyTotals: DailyTotal[] = Array.from(dailyMap.entries())
    .map(([date, { total, count, quantity }]) => ({ date, total, count, quantity }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const hourlyByDayObj: Record<string, number[]> = {};
  for (const [date, hours] of hourlyByDay) hourlyByDayObj[date] = hours;

  const dailyByPayment: PaymentDaily[] = dailyTotals.map(({ date }) => ({
    date,
    totals: paymentByDay.get(date) ?? {},
  }));

  const byProduct = Array.from(productMap.values()).sort(
    (a, b) => b.total - a.total || b.quantity - a.quantity || a.name.localeCompare(b.name, "ja"),
  );

  return { dailyTotals, hourlyByDay: hourlyByDayObj, byPayment, dailyByPayment, byProduct };
}
