import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { formatJstDateKey, formatJstDateTime } from "@/lib/datetime";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment";
import type { PaymentMethod } from "@generated/prisma/enums";


function csvEscape(value: string | number) {
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Every day by default; ?day=YYYY-MM-DD (JST) limits it to that one day.
export async function GET(request: Request) {
  const instance = await getCurrentInstance();
  if (!instance) return new Response("unauthorized", { status: 401 });

  const day = new URL(request.url).searchParams.get("day");
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Response("invalid day", { status: 400 });

  const allOrders = await prisma.order.findMany({
    where: { instanceId: instance.id, status: { not: "CANCELLED" } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  const orders = day ? allOrders.filter((o) => formatJstDateKey(o.createdAt) === day) : allOrders;

  const rows = ["ID(OrderDB),timestamp,支払い方法,商品名,点数,商品単体価格,顧客特徴"];
  for (const order of orders) {
    const timestamp = formatJstDateTime(order.createdAt);
    const payment = PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod];
    for (const item of order.items) {
      rows.push(
        [
          csvEscape(order.id),
          csvEscape(timestamp),
          csvEscape(payment),
          csvEscape(item.productName),
          csvEscape(item.quantity),
          csvEscape(item.unitPrice),
          csvEscape(order.customerNote ?? ""),
        ].join(","),
      );
    }
  }

  const csv = `﻿${rows.join("\r\n")}\r\n`;
  const filename = `売上管理簿_${instance.name}_${day ?? "全日程"}.csv`.replace(/[\\/:*?"<>|]/g, "_");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
