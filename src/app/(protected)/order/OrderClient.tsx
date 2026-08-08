"use client";

import { useMemo, useState } from "react";
import type { ProductModel as Product } from "@generated/prisma/models";
import type { PaymentMethod } from "@generated/prisma/enums";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment";
import ProductCard from "@/components/ProductCard";

type CartLine = { product: Product; quantity: number };

export default function OrderClient({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerNote, setCustomerNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lines: CartLine[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({
          product: products.find((p) => p.id === productId)!,
          quantity,
        }))
        .filter((line) => line.product),
    [cart, products],
  );

  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  function addOne(productId: string) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta);
      return { ...prev, [productId]: next };
    });
  }

  function resetForm() {
    setCart({});
    setCustomerNote("");
    setPaymentMethod(null);
  }

  async function handleSubmit() {
    setError(null);
    setMessage(null);
    if (lines.length === 0) {
      setError("商品を1つ以上選択してください");
      return;
    }
    if (!paymentMethod) {
      setError("支払い方法を選択してください");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          customerNote,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "注文の登録に失敗しました");
      resetForm();
      setMessage("注文を受け付けました");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "注文の登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-base font-semibold text-neutral-800">注文</h1>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onClick={() => addOne(product.id)} />
        ))}
        {products.length === 0 && (
          <p className="col-span-full text-sm text-neutral-400">
            商品が登録されていません。商品管理画面から追加してください。
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
        <h2 className="text-sm font-semibold text-neutral-700">選択中の商品</h2>
        {lines.length === 0 && <p className="text-sm text-neutral-400">まだ商品が選択されていません</p>}
        {lines.map((line) => (
          <div key={line.product.id} className="flex items-center justify-between gap-2">
            <span className="text-sm">{line.product.name}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeQty(line.product.id, -1)}
                className="h-7 w-7 rounded bg-neutral-100 text-sm font-bold"
              >
                −
              </button>
              <span className="w-6 text-center text-sm">{line.quantity}</span>
              <button
                type="button"
                onClick={() => changeQty(line.product.id, 1)}
                className="h-7 w-7 rounded bg-neutral-100 text-sm font-bold"
              >
                +
              </button>
            </div>
          </div>
        ))}
        {lines.length > 0 && (
          <p className="pt-1 text-right text-sm font-semibold text-neutral-700">合計 {total}円</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs text-neutral-600">
        客の特徴(任意)
        <input
          value={customerNote}
          onChange={(e) => setCustomerNote(e.target.value)}
          placeholder="例: 赤い帽子、黒いリュック"
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-neutral-600">支払い方法</span>
        <div className="flex gap-2">
          {PAYMENT_METHOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPaymentMethod(opt.value)}
              className={`flex-1 rounded-md border px-2 py-2 text-sm font-medium ${
                paymentMethod === opt.value
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-md bg-neutral-900 px-3 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {submitting ? "送信中..." : "注文を確定する"}
      </button>
    </div>
  );
}
