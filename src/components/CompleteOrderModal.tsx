"use client";

import { useState } from "react";
import type { PaymentMethod } from "@generated/prisma/enums";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment";
import type { OrderWithItems } from "@/components/EditOrderModal";

export default function CompleteOrderModal({
  order,
  allServed = false,
  onClose,
  onCompleted,
}: {
  order: OrderWithItems;
  // Opened because the last item was just handed over (partial serving).
  allServed?: boolean;
  onClose: () => void;
  onCompleted: (order: OrderWithItems) => void;
}) {
  // A sent-back order whose method was set to 不明 has to be chosen again.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    order.paymentMethod === "UNKNOWN" ? null : (order.paymentMethod as PaymentMethod),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Pay by method": how many pieces of each item go to each payment method.
  // Starts with everything on the order's own method.
  const [splitting, setSplitting] = useState(false);
  const [alloc, setAlloc] = useState<Record<string, Record<PaymentMethod, number>>>({});

  function openSplit() {
    const base = paymentMethod;
    if (!base) return;
    setAlloc(
      Object.fromEntries(
        order.items.map((i) => [
          i.id,
          Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.value === base ? i.quantity : 0])),
        ]),
      ) as Record<string, Record<PaymentMethod, number>>,
    );
    setSplitting(true);
  }

  // Moves one piece to `to` from the method holding the most others (+), or
  // back to the chosen base method (−). The item's total never changes.
  function move(itemId: string, to: PaymentMethod, delta: 1 | -1) {
    const base = paymentMethod;
    if (!base) return;
    setAlloc((prev) => {
      const row = { ...prev[itemId] };
      const others = PAYMENT_METHOD_OPTIONS.map((o) => o.value).filter((m) => m !== to && row[m] > 0);
      if (delta === 1) {
        const from = others.sort((a, b) => row[b] - row[a])[0];
        if (!from) return prev;
        row[from] -= 1;
        row[to] += 1;
      } else {
        if (row[to] <= 0 || to === base) return prev;
        row[to] -= 1;
        row[base] += 1;
      }
      return { ...prev, [itemId]: row };
    });
  }

  const groups = splitting
    ? PAYMENT_METHOD_OPTIONS.map((opt) => ({
        paymentMethod: opt.value,
        label: opt.label,
        items: order.items
          .map((i) => ({ itemId: i.id, name: i.productName, quantity: alloc[i.id]?.[opt.value] ?? 0 }))
          .filter((i) => i.quantity > 0),
      })).filter((g) => g.items.length > 0)
    : [];

  async function handleConfirm() {
    if (!splitting && !paymentMethod) {
      setError("支払い方法を選んでください");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body =
        splitting && groups.length > 1
          ? { split: groups.map((g) => ({ paymentMethod: g.paymentMethod, items: g.items.map(({ itemId, quantity }) => ({ itemId, quantity })) })) }
          : { paymentMethod: splitting && groups.length === 1 ? groups[0].paymentMethod : paymentMethod };
      const res = await fetch(`/api/orders/${order.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "完了に失敗しました");
        return;
      }
      onCompleted(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-full w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-lg bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-800">提供完了にする</h2>
        {allServed && (
          <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
            全品を提供しました。支払い方法に変更がないか確認して「確定」してください。
          </p>
        )}

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

        {splitting ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-600">支払い方法ごとの個数</span>
              <button type="button" onClick={() => setSplitting(false)} className="text-xs text-neutral-500 underline">
                分けない
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {order.items.map((item) => (
                <li key={item.id} className="rounded-md border border-neutral-200 p-2">
                  <p className="mb-1 text-sm text-neutral-800">
                    {item.productName} × {item.quantity}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PAYMENT_METHOD_OPTIONS.map((opt) => {
                      const n = alloc[item.id]?.[opt.value] ?? 0;
                      const stepper =
                        "flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 disabled:opacity-30";
                      return (
                        <div
                          key={opt.value}
                          className={`flex flex-col items-center rounded-md py-1 ${n > 0 ? "bg-neutral-100" : ""}`}
                        >
                          <span className="text-[11px] text-neutral-600">{opt.label}</span>
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`${opt.label}を1つ減らす`}
                              disabled={n <= 0 || opt.value === paymentMethod}
                              onClick={() => move(item.id, opt.value, -1)}
                              className={stepper}
                            >
                              −
                            </button>
                            <span className="w-4 text-center text-sm font-bold tabular-nums">{n}</span>
                            <button
                              type="button"
                              aria-label={`${opt.label}を1つ増やす`}
                              disabled={n >= item.quantity}
                              onClick={() => move(item.id, opt.value, 1)}
                              className={stepper}
                            >
                              ＋
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-neutral-500">
              {groups.length > 1
                ? `支払い方法ごとに${groups.length}件の注文に分かれます(特徴欄はコピーされます): ${groups
                    .map((g) => `${g.label} ${g.items.map((i) => `${i.name}×${i.quantity}`).join("・")}`)
                    .join(" / ")}`
                : "すべて同じ支払い方法なので、分かれません。"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-600">支払い方法</span>
              <button
                type="button"
                onClick={openSplit}
                disabled={!paymentMethod}
                className="text-xs text-neutral-500 underline disabled:opacity-40"
              >
                支払い方法を分ける
              </button>
            </div>
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
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

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
