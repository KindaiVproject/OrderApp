"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductModel } from "@generated/prisma/models";
import type { PaymentMethod } from "@generated/prisma/enums";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment";
import EditOrderModal, { type OrderWithItems as Order } from "@/components/EditOrderModal";
import CompleteOrderModal from "@/components/CompleteOrderModal";

const POLL_INTERVAL_MS = 2500;

export default function KitchenClient({
  initialOrders,
  products,
}: {
  initialOrders: Order[];
  products: ProductModel[];
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [completingOrder, setCompletingOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const pollingPaused = useRef(false);

  useEffect(() => {
    pollingPaused.current = editingOrder !== null || completingOrder !== null;
  }, [editingOrder, completingOrder]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (pollingPaused.current) return;
      try {
        const res = await fetch("/api/orders?status=WAITING");
        if (!res.ok) return;
        const data = await res.json();
        setOrders(data);
      } catch {
        // ignore transient network errors, next tick retries
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const requiredCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        counts.set(item.productName, (counts.get(item.productName) ?? 0) + item.quantity);
      }
    }
    return Array.from(counts.entries());
  }, [orders]);

  function toggleSelect(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  async function completeBulk() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await fetch("/api/orders/complete-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      setOrders((prev) => prev.filter((o) => !selected.has(o.id)));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-neutral-800">厨房</h1>
        <span className="text-sm text-neutral-500">待機中: {orders.length}件</span>
      </div>

      {requiredCounts.length > 0 && (
        <div className="rounded-lg border border-neutral-200 p-3">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">作るべき個数</h2>
          <div className="flex flex-wrap gap-2">
            {requiredCounts.map(([name, qty]) => (
              <span
                key={name}
                className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
              >
                {name} × {qty}
              </span>
            ))}
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-neutral-900 px-3 py-2 text-white">
          <span className="text-sm">{selected.size}件選択中</span>
          <button
            type="button"
            onClick={completeBulk}
            disabled={busy}
            className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 disabled:opacity-40"
          >
            まとめて完了
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {orders.map((order) => (
          <li key={order.id} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selected.has(order.id)}
                onChange={() => toggleSelect(order.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                  <span>{new Date(order.createdAt).toLocaleTimeString("ja-JP")}</span>
                  <span>{PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]}</span>
                  {order.customerNote && <span>特徴: {order.customerNote}</span>}
                </div>
                <ul className="mt-1 flex flex-col">
                  {order.items.map((item) => (
                    <li key={item.id} className="text-sm">
                      {item.productName} × {item.quantity}
                    </li>
                  ))}
                </ul>

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletingOrder(order)}
                    className="rounded bg-neutral-900 px-2 py-1 text-xs font-semibold text-white"
                  >
                    提供完了
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingOrder(order)}
                    className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                  >
                    編集
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
        {orders.length === 0 && <p className="text-sm text-neutral-400">待機中の注文はありません</p>}
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

      {completingOrder && (
        <CompleteOrderModal
          order={completingOrder}
          onClose={() => setCompletingOrder(null)}
          onCompleted={(completed) => {
            setOrders((prev) => prev.filter((o) => o.id !== completed.id));
            setCompletingOrder(null);
          }}
        />
      )}
    </div>
  );
}
