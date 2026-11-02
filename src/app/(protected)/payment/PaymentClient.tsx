"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizePaymentLink } from "@/lib/paymentLinks";
import QrScanner from "./QrScanner";

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
          <p className="text-lg font-bold" style={{ color: ACCENTS[zoomed.kind] ?? DEFAULT_ACCENT }}>{zoomed.label}</p>
          <QrImage src={zoomed.qr} kind={zoomed.kind} label={zoomed.label} className="w-full max-w-[min(90vw,80vh)]" />
          <p className="text-xs text-neutral-500">どこかをタップして閉じる</p>
        </div>
      )}
    </div>
  );
}

// Each method gets its own accent so the two codes are told apart at a glance.
const ACCENTS: Record<string, string> = { paypay: "#e11d48", dpayment: "#ea580c" };
const DEFAULT_ACCENT = "#171717";

// The badge in the middle carries the app's logo and the method's name (plain
// text, not the companies' logos, which are trademarks with usage rules). It
// covers about 7% of the code, well inside what error-correction level H can
// lose. Sizes use container units so it scales with the zoomed view too.
function QrImage({ src, kind, label, className }: { src: string; kind: string; label: string; className: string }) {
  const accent = ACCENTS[kind] ?? DEFAULT_ACCENT;
  return (
    <span className={`@container relative block aspect-square ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${label}の決済QR`} className="size-full [image-rendering:pixelated]" />
      <span
        className="absolute left-1/2 top-1/2 flex w-[27%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[1cqw] rounded-[3cqw] bg-white p-[1.8cqw]"
        style={{ boxShadow: `inset 0 0 0 0.9cqw ${accent}` }}
      >
        <Image src="/logo.svg" alt="" width={64} height={64} className="w-[45%] rounded-[1.5cqw]" />
        <span className="whitespace-nowrap font-bold leading-none" style={{ color: accent, fontSize: "5.4cqw" }}>
          {label}
        </span>
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
  const [scanned, setScanned] = useState(false);
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
    <section
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 border-t-4 bg-white p-4 shadow-sm"
      style={{ borderTopColor: ACCENTS[link.kind] ?? DEFAULT_ACCENT }}
    >
      <h2 className="text-sm font-semibold" style={{ color: ACCENTS[link.kind] ?? DEFAULT_ACCENT }}>
        {link.label}
      </h2>

      {link.qr ? (
        <button
          type="button"
          onClick={onZoom}
          aria-label={`${link.label}のQRを拡大`}
          className="mx-auto w-full max-w-64 rounded-lg border border-neutral-200 p-1"
        >
          <QrImage src={link.qr} kind={link.kind} label={link.label} className="w-full" />
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
            onChange={(e) => {
              setValue(e.target.value);
              setScanned(false);
            }}
            placeholder="https://"
            maxLength={500}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <QrScanner
            label={link.label}
            onRead={(text) => {
              const url = normalizePaymentLink(text);
              if (!url) {
                setError("読み取ったQRは https:// で始まるリンクではありませんでした。決済リンクのQRか確認してください");
                return;
              }
              setError(null);
              setScanned(true);
              setValue(url);
            }}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          {scanned && !error && dirty && (
            <p className="text-xs text-green-700">読み取りました。内容を確認して「{link.url ? "変更を保存" : "登録"}」を押してください。</p>
          )}
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
