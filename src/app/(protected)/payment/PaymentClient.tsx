"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LinkInfo = { kind: string; label: string; url: string; qr: string | null };

export default function PaymentClient({ links, canEdit }: { links: LinkInfo[]; canEdit: boolean }) {
  const [zoomed, setZoomed] = useState<LinkInfo | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-4">
      <h1 className="mb-1 text-lg font-bold text-neutral-800">決済QR</h1>
      <p className="mb-4 text-xs text-neutral-500">
        QRをタップすると拡大します。お客さんに読み取ってもらってください。
        {canEdit ? "リンクの登録・変更はこの画面で行えます(管理者・インスタンス管理者のみ)。" : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <LinkCard key={link.kind} link={link} canEdit={canEdit} onZoom={() => setZoomed(link)} />
        ))}
      </div>

      {zoomed?.qr && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white p-4"
          onClick={() => setZoomed(null)}
        >
          <p className="text-lg font-bold text-neutral-800">{zoomed.label}</p>
          <QrImage src={zoomed.qr} label={zoomed.label} className="w-full max-w-[min(90vw,80vh)]" />
          <p className="text-xs text-neutral-500">どこかをタップして閉じる</p>
        </div>
      )}
    </div>
  );
}

// The app's own logo sits in the middle. It covers about 5% of the code, well
// inside what error-correction level H can lose. Payment companies' own logos
// are deliberately not used: they are trademarks with usage rules.
function QrImage({ src, label, className }: { src: string; label: string; className: string }) {
  return (
    <span className={`relative block aspect-square ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${label}の決済QR`} className="size-full [image-rendering:pixelated]" />
      <span className="absolute left-1/2 top-1/2 flex w-[22%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-white p-[1.5%]">
        <Image src="/logo.svg" alt="" width={64} height={64} className="size-full rounded-md" />
      </span>
    </span>
  );
}

function LinkCard({
  link,
  canEdit,
  onZoom,
}: {
  link: LinkInfo;
  canEdit: boolean;
  onZoom: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(link.url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value.trim() !== link.url;

  async function save(url: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/payment-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: link.kind, url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "保存に失敗しました");
      }
      setValue(url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-800">{link.label}</h2>

      {link.qr ? (
        <button
          type="button"
          onClick={onZoom}
          aria-label={`${link.label}のQRを拡大`}
          className="mx-auto w-full max-w-64 rounded-lg border border-neutral-200 p-1"
        >
          <QrImage src={link.qr} label={link.label} className="w-full" />
        </button>
      ) : (
        <p className="rounded-lg bg-neutral-100 px-3 py-8 text-center text-xs text-neutral-500">
          まだ登録されていません
        </p>
      )}

      {canEdit && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-neutral-600" htmlFor={`link-${link.kind}`}>
            決済リンク(https://…)
          </label>
          <input
            id={`link-${link.kind}`}
            type="url"
            inputMode="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://"
            maxLength={500}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => save(value.trim())}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {saving ? "保存中…" : link.url ? "変更を保存" : "登録"}
            </button>
            {link.url && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (window.confirm(`${link.label}の決済リンクを削除しますか?`)) save("");
                }}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-40"
              >
                削除
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
