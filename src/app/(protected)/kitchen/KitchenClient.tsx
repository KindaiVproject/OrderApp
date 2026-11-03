"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ProductModel } from "@generated/prisma/models";
import type { PaymentMethod } from "@generated/prisma/enums";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment";
import { formatJstTime } from "@/lib/datetime";
import EditOrderModal, { type OrderWithItems as Order } from "@/components/EditOrderModal";
import CompleteOrderModal from "@/components/CompleteOrderModal";
import ConfirmModal from "@/components/ConfirmModal";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import {
  getVolumeServerSnapshot,
  getVolumeSnapshot,
  isOrderSoundId,
  playOrderSound,
  saveVolume,
  subscribeVolume,
  unlockAudio,
  type OrderSoundId,
} from "@/lib/orderSound";
import OrderSoundControl from "./OrderSoundControl";

const POLL_INTERVAL_MS = 2500;
// Waiting orders at or above this count turn the counter red.
const WAITING_ALERT_COUNT = 5;
// How often to pick up a change of the instance's order sound made elsewhere.
const SOUND_POLL_INTERVAL_MS = 15000;

export default function KitchenClient({
  initialOrders,
  products,
  initialSoundId,
  canEditSound,
}: {
  initialOrders: Order[];
  products: ProductModel[];
  initialSoundId: string;
  canEditSound: boolean;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [completingOrder, setCompletingOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const pollingPaused = useRef(false);
  // Which sound rings is shared by the instance; the volume is per device.
  const [soundId, setSoundId] = useState<OrderSoundId>(isOrderSoundId(initialSoundId) ? initialSoundId : "chime");
  const volume = useSyncExternalStore(subscribeVolume, getVolumeSnapshot, getVolumeServerSnapshot);
  const sound = useMemo(() => ({ id: soundId, volume }), [soundId, volume]);
  const soundRef = useRef(sound);
  // Ids seen on the last fetch, so only orders that are new since then ring.
  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)));

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/order-sound");
        if (!res.ok) return;
        const data = await res.json();
        if (isOrderSoundId(data.id)) setSoundId(data.id);
      } catch {
        // ignore transient network errors, next tick retries
      }
    }, SOUND_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  async function changeSoundId(id: OrderSoundId): Promise<string | null> {
    const res = await fetch("/api/order-sound", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error ?? "音の変更に失敗しました";
    }
    setSoundId(id);
    return null;
  }

  useEffect(() => {
    // Browsers keep audio muted until the page is touched; any tap unlocks it.
    const unlock = () => {
      void unlockAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    pollingPaused.current = editingOrder !== null || completingOrder !== null || cancellingOrder !== null;
  }, [editingOrder, completingOrder, cancellingOrder]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (pollingPaused.current) return;
      try {
        const res = await fetch("/api/orders?status=WAITING");
        if (!res.ok) return;
        const data: Order[] = await res.json();
        const arrived = data.some((o) => !knownIds.current.has(o.id));
        knownIds.current = new Set(data.map((o) => o.id));
        if (arrived) playOrderSound(soundRef.current.id, soundRef.current.volume);
        setOrders(data);
      } catch {
        // ignore transient network errors, next tick retries
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const requiredCounts = useMemo(() => {
    const counts = new Map<string, { qty: number; imageUrl: string | null }>();
    for (const order of orders) {
      for (const item of order.items) {
        // Only what is still to be made: the ones already handed over don't count.
        const remaining = item.quantity - item.servedQuantity;
        if (remaining <= 0) continue;
        const existing = counts.get(item.productName);
        counts.set(item.productName, {
          qty: (existing?.qty ?? 0) + remaining,
          imageUrl: existing?.imageUrl ?? item.imageUrl,
        });
      }
    }
    return Array.from(counts.entries());
  }, [orders]);

  // Quiet when nothing is waiting, then amber, then red as the queue backs up.
  const waitingTone =
    orders.length === 0
      ? "border-neutral-200 bg-white text-neutral-400"
      : orders.length < WAITING_ALERT_COUNT
        ? "border-amber-300 bg-amber-100 text-amber-800"
        : "border-red-300 bg-red-100 text-red-700";

  function toggleSelect(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  // Optimistic: the poll (or a failed request) puts the real value back.
  async function setServed(orderId: string, itemId: string, servedQuantity: number) {
    // Handing over the last piece: ask to confirm the payment method and complete.
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      const updated = {
        ...target,
        items: target.items.map((i) => (i.id === itemId ? { ...i, servedQuantity } : i)),
      };
      const wasAllServed = target.items.every((i) => i.servedQuantity >= i.quantity);
      if (!wasAllServed && updated.items.every((i) => i.servedQuantity >= i.quantity)) {
        setCompletingOrder(updated);
      }
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, servedQuantity } : i)) }
          : o,
      ),
    );
    try {
      await fetch(`/api/orders/${orderId}/served`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, servedQuantity }),
      });
    } catch {
      // ignore transient network errors; the next poll shows the saved value
    }
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
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-neutral-800">厨房</h1>
          <OrderSoundControl
            soundId={soundId}
            volume={volume}
            canEdit={canEditSound}
            onChangeSound={changeSoundId}
            onChangeVolume={saveVolume}
          />
        </div>
        <div
          aria-live="polite"
          className={`flex items-baseline gap-1.5 rounded-xl border px-4 py-1.5 shadow-sm ${waitingTone}`}
        >
          <span className="text-xs font-semibold">待機中</span>
          <span className="text-4xl font-bold leading-none tabular-nums">{orders.length}</span>
          <span className="text-xs font-semibold">件</span>
        </div>
      </div>

      {requiredCounts.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">作るべき個数</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {requiredCounts.map(([name, { qty, imageUrl }]) => (
              <li
                key={name}
                className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt=""
                      draggable={false}
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-full bg-neutral-300" />
                  )}
                  <span className="flex items-baseline gap-1 text-neutral-900">
                    <span className="text-sm font-semibold text-neutral-500">×</span>
                    <span className="text-5xl font-bold leading-none tabular-nums">{qty}</span>
                  </span>
                </div>
                <span className="break-words text-sm font-semibold leading-tight text-neutral-800">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-neutral-900 px-3 py-2 text-white shadow-sm">
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
          <li key={order.id} className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selected.has(order.id)}
                onChange={() => toggleSelect(order.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                  <span>{formatJstTime(new Date(order.createdAt))}</span>
                  <span>{PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]}</span>
                  {order.customerNote && <span>特徴: {order.customerNote}</span>}
                  <ServeBadge items={order.items} />
                </div>
                <ul className="mt-1 flex flex-col gap-1.5">
                  {order.items.map((item) => {
                    const done = item.servedQuantity >= item.quantity;
                    return (
                      <li key={item.id} className="flex items-center gap-2 text-sm">
                        {item.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt=""
                            draggable={false}
                            className={`h-8 w-8 rounded object-cover ${done ? "opacity-40" : ""}`}
                          />
                        )}
                        <span className={`flex-1 ${done ? "text-neutral-400 line-through" : ""}`}>
                          {item.productName} × {item.quantity}
                        </span>
                        <ServeControl
                          quantity={item.quantity}
                          served={item.servedQuantity}
                          onChange={(n) => setServed(order.id, item.id, n)}
                        />
                      </li>
                    );
                  })}
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
                  <button
                    type="button"
                    onClick={() => setCancellingOrder(order)}
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    キャンセル
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
          allServed={completingOrder.items.every((i) => i.servedQuantity >= i.quantity)}
          onClose={() => setCompletingOrder(null)}
          onCompleted={(completed) => {
            setOrders((prev) => prev.filter((o) => o.id !== completed.id));
            setCompletingOrder(null);
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
            setOrders((prev) => prev.filter((o) => o.id !== cancellingOrder.id));
            setCancellingOrder(null);
          }}
        />
      )}
      <ScrollToTopButton />
    </div>
  );
}

// "一部提供済": some of the order is handed over, some still to make.
function ServeBadge({ items }: { items: Order["items"] }) {
  const total = items.reduce((n, i) => n + i.quantity, 0);
  const served = items.reduce((n, i) => n + i.servedQuantity, 0);
  if (served === 0) return null;
  if (served >= total) {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        全品提供済 → 「提供完了」を押してください
      </span>
    );
  }
  return (
    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
      一部提供済 ・ 未提供 {total - served}個
    </span>
  );
}

// One item: a single toggle when it's one piece, otherwise a −/＋ counter of
// how many have been handed over.
function ServeControl({
  quantity,
  served,
  onChange,
}: {
  quantity: number;
  served: number;
  onChange: (served: number) => void;
}) {
  if (quantity === 1) {
    const done = served >= 1;
    return (
      <button
        type="button"
        onClick={() => onChange(done ? 0 : 1)}
        aria-pressed={done}
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
          done
            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
            : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
        }`}
      >
        {done ? "提供済" : "未提供"}
      </button>
    );
  }
  const done = served >= quantity;
  const step =
    "flex h-8 w-8 items-center justify-center rounded-full border text-base font-semibold disabled:opacity-30";
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="提供済を1つ減らす"
        disabled={served <= 0}
        onClick={() => onChange(served - 1)}
        className={`${step} border-neutral-300 bg-white text-neutral-700`}
      >
        −
      </button>
      <span
        className={`min-w-[3.25rem] text-center text-xs font-semibold tabular-nums ${
          done ? "text-emerald-700" : served > 0 ? "text-sky-700" : "text-neutral-500"
        }`}
      >
        提供 {served}/{quantity}
      </span>
      <button
        type="button"
        aria-label="提供済を1つ増やす"
        disabled={done}
        onClick={() => onChange(served + 1)}
        className={`${step} border-neutral-300 bg-white text-neutral-700`}
      >
        ＋
      </button>
    </span>
  );
}
