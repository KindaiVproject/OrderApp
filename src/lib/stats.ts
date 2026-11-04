import { prisma } from "@/lib/prisma";
import { formatJstDateKey, getJstHour } from "@/lib/datetime";
import { PAYMENT_METHOD_OPTIONS, UNKNOWN_PAYMENT_OPTION } from "@/lib/payment";

export type DailyTotal = { date: string; total: number; count: number; quantity: number };
export type HourlyTotal = { hour: number; total: number };
export type PaymentTotal = { method: string; label: string; total: number; count: number; quantity: number };
export type ProductTotal = { name: string; total: number; quantity: number; orders: number };
export type PaymentDaily = { date: string; totals: Record<string, number> };

// `day` ("YYYY-MM-DD", JST) limits everything to that one day; leave it out for
// the whole period.
export async function getOrderStats(instanceId: string, day?: string) {
  // Cancelled orders never became a sale — same population as the CSV export.
  const allOrders = await prisma.order.findMany({
    where: { instanceId, status: { not: "CANCELLED" } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  const orders = day ? allOrders.filter((o) => formatJstDateKey(o.createdAt) === day) : allOrders;

  const dailyMap = new Map<string, { total: number; count: number; quantity: number }>();
  const hourlyByDay = new Map<string, number[]>();
  const byPayment: PaymentTotal[] = [...PAYMENT_METHOD_OPTIONS, UNKNOWN_PAYMENT_OPTION].map(({ value, label }) => ({
    method: value,
    label,
    total: 0,
    count: 0,
    quantity: 0,
  }));
  const paymentByDay = new Map<string, Record<string, number>>();
  // Per product name (the name snapshot on the order line, so renamed or
  // deleted products still count).
  const productMap = new Map<string, ProductTotal>();
  const productByDay: Record<string, Record<string, { quantity: number; total: number }>> = {};

  for (const order of orders) {
    // Free lines (0円) count for nothing here: not as pieces sold, and an order
    // made only of them is not an order in the statistics.
    const paidItems = order.items.filter((i) => i.unitPrice > 0);
    if (paidItems.length === 0) continue;
    const total = paidItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const quantity = paidItems.reduce((sum, i) => sum + i.quantity, 0);
    const dateKey = formatJstDateKey(order.createdAt);
    const hour = getJstHour(order.createdAt);

    const day = dailyMap.get(dateKey) ?? { total: 0, count: 0, quantity: 0 };
    day.total += total;
    day.count += 1;
    day.quantity += quantity;
    dailyMap.set(dateKey, day);

    for (const item of paidItems) {
      const p = productMap.get(item.productName) ?? { name: item.productName, total: 0, quantity: 0, orders: 0 };
      p.total += item.unitPrice * item.quantity;
      p.quantity += item.quantity;
      p.orders += 1;
      productMap.set(item.productName, p);
      const dayProducts = (productByDay[dateKey] ??= {});
      const d = (dayProducts[item.productName] ??= { quantity: 0, total: 0 });
      d.quantity += item.quantity;
      d.total += item.unitPrice * item.quantity;
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

  return {
    dailyTotals,
    hourlyByDay: hourlyByDayObj,
    // 不明 only shows up once an order has been set to it.
    byPayment: byPayment.filter((p) => p.method !== "UNKNOWN" || p.count > 0),
    dailyByPayment,
    byProduct,
    productByDay,
  };
}
