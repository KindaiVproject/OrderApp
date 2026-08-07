"use client";

import { useState } from "react";
import type { OrderModel, OrderItemModel, ProductModel } from "@generated/prisma/models";
import type { PaymentMethod } from "@generated/prisma/enums";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment";

export type OrderWithItems = OrderModel & { items: OrderItemModel[] };

export default function EditOrderModal({
  order,
  products,
  onClose,
  onSaved,
}: {
  order: OrderWithItems;
  products: ProductModel[];
  onClose: () => void;
  onSaved: (order: OrderWithItems) => void;
}) {
  const [cart, setCart] = useState<Record<string, number>>(
    Object.fromEntries(order.items.filter((i) => i.productId).map((i) => [i.productId as string, i.quantity])),
  );
  const [customerNote, setCustomerNote] = useState(order.customerNote ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order.paymentMethod as PaymentMethod);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeQty(productId: string, delta: number) {
    setCart((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] ?? 0) + delta) }));
  }

  async function handleSave() {
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0) {
      setError("商品を1つ以上選択してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, customerNote, paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "更新に失敗しました");
      onSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-lg bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-800">注文を編集</h2>

        <div className="grid grid-cols-3 gap-2">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => changeQty(product.id, 1)}
              className="rounded border border-neutral-200 p-2 text-center text-xs active:bg-neutral-100"
            >
              {product.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {Object.entries(cart)
            .filter(([, qty]) => qty > 0)
            .map(([productId, qty]) => {
              const product = products.find((p) => p.id === productId);
              if (!product) return null;
              return (
                <div key={productId} className="flex items-center justify-between text-sm">
                  <span>{product.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeQty(productId, -1)}
                      className="h-6 w-6 rounded bg-neutral-100 text-xs font-bold"
                    >
                      −
                    </button>
                    <span className="w-5 text-center">{qty}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(productId, 1)}
                      className="h-6 w-6 rounded bg-neutral-100 text-xs font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          客の特徴
          <input
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>

        <div className="flex gap-1">
          {PAYMENT_METHOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPaymentMethod(opt.value)}
              className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
                paymentMethod === opt.value ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-neutral-500">
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
