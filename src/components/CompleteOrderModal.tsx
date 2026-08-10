"use client";

import { useState } from "react";
import type { PaymentMethod } from "@generated/prisma/enums";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment";
import type { OrderWithItems } from "@/components/EditOrderModal";

export default function CompleteOrderModal({
  order,
  onClose,
  onCompleted,
}: {
  order: OrderWithItems;
  onClose: () => void;
  onCompleted: (order: OrderWithItems) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order.paymentMethod as PaymentMethod);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json();
      onCompleted(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-800">提供完了にする</h2>

        <div className="rounded-md bg-neutral-50 p-2">
          <ul className="flex flex-col gap-1">
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
          {order.customerNote && (
            <p className="mt-1 text-xs text-neutral-500">特徴: {order.customerNote}</p>
          )}
          <p className="mt-1 text-xs text-neutral-400">
            注文時の選択: {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">支払い方法</span>
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
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-neutral-500">
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}
