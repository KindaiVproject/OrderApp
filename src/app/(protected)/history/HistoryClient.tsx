"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductModel } from "@generated/prisma/models";
import type { PaymentMethod } from "@generated/prisma/enums";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment";
import { formatJstDateTime } from "@/lib/datetime";
import EditOrderModal, { type OrderWithItems as Order } from "@/components/EditOrderModal";
import ConfirmModal from "@/components/ConfirmModal";

const STATUS_LABELS: Record<string, string> = {
  WAITING: "待機中",
  COMPLETED: "提供済み",
  CANCELLED: "キャンセル済み",
};

const STATUS_STYLES: Record<string, string> = {
  WAITING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-neutral-200 text-neutral-500",
};

export default function HistoryClient({
  initialOrders,
  products,
}: {
  initialOrders: Order[];
  products: ProductModel[];
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-neutral-800">注文履歴</h1>
        <Link
          href="/api/orders/export"
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          CSV出力
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {orders.map((order) => {
          const total = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
          const cancelled = order.status === "CANCELLED";
          return (
            <li
              key={order.id}
              className={`rounded-lg border border-neutral-200 bg-white p-3 shadow-sm ${
                cancelled ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                <span>{formatJstDateTime(new Date(order.createdAt))}</span>
                <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_STYLES[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
                <span>{PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]}</span>
                {order.customerNote && <span>特徴: {order.customerNote}</span>}
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        draggable={false}
                        className="h-8 w-8 rounded object-cover"
                      />
                    )}
                    <span>
                      {item.productName} × {item.quantity}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-700">{total}円</span>
                {!cancelled && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingOrder(order)}
                      className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancellingOrder(order)}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      キャンセル
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {orders.length === 0 && <p className="text-sm text-neutral-400">注文履歴がありません</p>}
      </ul>

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          products={products}
          onClose={() => setEditingOrder(null)}
          onSaved={(updated) => {
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            setEditingOrder(null);
          }}
        />
      )}

      {cancellingOrder && (
        <ConfirmModal
          title="注文をキャンセル"
          message={`この注文(${cancellingOrder.items
            .map((i) => `${i.productName} × ${i.quantity}`)
            .join(", ")})をキャンセルしますか？`}
          onClose={() => setCancellingOrder(null)}
          onConfirm={async () => {
            const res = await fetch(`/api/orders/${cancellingOrder.id}/cancel`, { method: "POST" });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error ?? "キャンセルに失敗しました");
            }
            const updated = await res.json();
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            setCancellingOrder(null);
          }}
        />
      )}
    </div>
  );
}
