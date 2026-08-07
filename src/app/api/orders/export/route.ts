import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@generated/prisma/enums";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "現金/金券",
  PAYPAY: "PayPay",
  D_PAYMENT: "d払い",
};

function formatTimestamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function csvEscape(value: string | number) {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const instance = await getCurrentInstance();
  if (!instance) return new Response("unauthorized", { status: 401 });

  const orders = await prisma.order.findMany({
    where: { instanceId: instance.id },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const rows = ["ID(OrderDB),timestamp,支払い方法,商品名,点数,商品単体価格"];
  for (const order of orders) {
    const timestamp = formatTimestamp(order.createdAt);
    const payment = PAYMENT_LABELS[order.paymentMethod as PaymentMethod];
    for (const item of order.items) {
      rows.push(
        [
          csvEscape(order.id),
          csvEscape(timestamp),
          csvEscape(payment),
          csvEscape(item.productName),
          csvEscape(item.quantity),
          csvEscape(item.unitPrice),
        ].join(","),
      );
    }
  }

  const csv = `﻿${rows.join("\r\n")}\r\n`;
  const filename = `売上管理簿_${instance.name}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
