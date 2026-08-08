"use client";

import { useState } from "react";
import type { ProductModel as Product } from "@generated/prisma/models";
import ProductImagePicker from "@/components/ProductImagePicker";

export default function ProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("商品名を入力してください");
      return;
    }
    const priceNum = Number(price);
    if (!Number.isInteger(priceNum) || priceNum < 0) {
      setError("価格は0以上の整数で入力してください(検品用は0円でOK)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), price: priceNum, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登録に失敗しました");
      setProducts((prev) => [...prev, data]);
      setName("");
      setPrice("");
      setImageUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("この商品を削除しますか？(過去の注文履歴には影響しません)")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-base font-semibold text-neutral-800">商品管理</h1>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            商品名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-40 rounded border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="例: 焼きとうもろこし"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            価格(円)
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-24 rounded border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="0円=検品用"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            追加
          </button>
        </div>
        <ProductImagePicker value={imageUrl} onChange={setImageUrl} />
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="flex flex-col gap-2">
        {products.map((product) => (
          <li
            key={product.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-2 shadow-sm"
          >
            <span className="flex items-center gap-2 text-sm">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-neutral-100 bg-neutral-50">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[9px] text-neutral-300">なし</span>
                )}
              </span>
              {product.name}{" "}
              <span className="text-neutral-400">
                ({product.price === 0 ? "検品用/0円" : `${product.price}円`})
              </span>
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setEditingProduct(product)}
                className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => handleArchive(product.id)}
                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                削除
              </button>
            </div>
          </li>
        ))}
        {products.length === 0 && <p className="text-sm text-neutral-400">まだ商品が登録されていません。</p>}
      </ul>

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={(updated) => {
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}

function EditProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: (product: Product) => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [imageUrl, setImageUrl] = useState<string | null>(product.imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    const priceNum = Number(price);
    if (!name.trim()) {
      setError("商品名を入力してください");
      return;
    }
    if (!Number.isInteger(priceNum) || priceNum < 0) {
      setError("価格は0以上の整数で入力してください");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), price: priceNum, imageUrl }),
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
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-800">商品を編集</h2>

        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          商品名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          価格(円)
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>

        <ProductImagePicker value={imageUrl} onChange={setImageUrl} />

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
