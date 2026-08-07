"use client";

import { useRef, useState } from "react";
import { DEFAULT_PRODUCT_IMAGES } from "@/lib/defaultProductImages";

export default function ProductImagePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/products/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "アップロードに失敗しました");
      onChange(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/products/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成に失敗しました");
      onChange(data.imageUrl);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-neutral-400">画像なし</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
          >
            {uploading ? "アップロード中..." : "画像を選ぶ"}
          </button>
          <button
            type="button"
            onClick={() => setShowDefaults((v) => !v)}
            className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
          >
            デフォルトから選ぶ
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              画像を削除
            </button>
          )}
        </div>
      </div>

      {showDefaults && (
        <div className="flex flex-wrap gap-2 rounded-md border border-neutral-200 p-2">
          {DEFAULT_PRODUCT_IMAGES.map((img) => (
            <button
              key={img.url}
              type="button"
              onClick={() => {
                onChange(img.url);
                setShowDefaults(false);
              }}
              className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded border ${
                value === img.url ? "border-neutral-900" : "border-neutral-200"
              }`}
              title={img.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.label} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="AIで生成: 例 焼きたてのたこ焼き6個"
          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="rounded bg-neutral-800 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          {generating ? "生成中..." : "AIで生成"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
