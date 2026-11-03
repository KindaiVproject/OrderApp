"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OTHER_QR_LABEL_MAX, OTHER_QR_MAX_COUNT } from "@/lib/otherQr";
import { normalizePaymentLink } from "@/lib/paymentLinks";
import QrImage, { type LinkInfo } from "./QrImage";
import QrScanner from "./QrScanner";

export type OtherQrInfo = { id: string; label: string; url: string; qr: string };

// "その他のQR": extra QR codes besides PayPay / d払い. Everyone can view and
// enlarge them; editors register new ones and change or delete existing ones.
export default function OtherQrs({
  items,
  canEdit,
  onZoom,
}: {
  items: OtherQrInfo[];
  canEdit: boolean;
  onZoom: (link: LinkInfo) => void;
}) {
  if (items.length === 0 && !canEdit) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-base font-bold text-neutral-800">その他のQR</h2>
      <p className="mb-4 text-xs text-neutral-500">
        アンケートや連絡先など、決済以外のQRです。
        {canEdit ? "QRのリンクを入れると、サイトの情報からラベルを自動で入れます(登録前に直せます)。" : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <OtherQrCard
            key={item.id}
            item={item}
            canEdit={canEdit}
            onZoom={() => onZoom({ kind: `other-${item.id}`, label: item.label, url: item.url, qr: item.qr })}
          />
        ))}
        {canEdit &&
          (items.length < OTHER_QR_MAX_COUNT ? (
            <OtherQrCard item={null} canEdit onZoom={() => {}} />
          ) : (
            <p className="text-xs text-neutral-500">登録できるのは{OTHER_QR_MAX_COUNT}件までです。</p>
          ))}
      </div>
    </section>
  );
}

// One card: an existing QR (item) or the blank form that adds a new one (null).
function OtherQrCard({ item, canEdit, onZoom }: { item: OtherQrInfo | null; canEdit: boolean; onZoom: () => void }) {
  const router = useRouter();
  const adding = item === null;
  const [url, setUrl] = useState(item?.url ?? "");
  const [label, setLabel] = useState(item?.label ?? "");
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // Once the label has been typed by hand, the page's title never overwrites it.
  const labelEdited = useRef(false);
  const lookupSeq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const dirty = adding || url.trim() !== item.url || label.trim() !== item.label;
  const ready = url.trim() !== "" && label.trim() !== "";

  // Asks the server for the page's title. `force` replaces the label even if
  // it was typed by hand (the 「サイトから取得」 button).
  async function lookup(target: string, force: boolean) {
    if (!normalizePaymentLink(target)) return;
    const seq = ++lookupSeq.current;
    setLooking(true);
    setHint(null);
    try {
      const res = await fetch(`/api/other-qrs/metadata?url=${encodeURIComponent(target)}`);
      const data = await res.json().catch(() => null);
      if (seq !== lookupSeq.current) return;
      if (!res.ok || typeof data?.label !== "string") {
        setHint("サイトの情報を取得できませんでした。ラベルを入力してください");
        return;
      }
      if (force || !labelEdited.current) {
        setLabel(data.label);
        labelEdited.current = false;
      }
      setHint(
        data.fromPage
          ? "サイトの情報からラベルを入れました。必要なら直してください"
          : "サイトのタイトルを取得できなかったので、ドメイン名を入れました。必要なら直してください",
      );
    } catch {
      if (seq === lookupSeq.current) setHint("サイトの情報を取得できませんでした。ラベルを入力してください");
    } finally {
      if (seq === lookupSeq.current) setLooking(false);
    }
  }

  // Typing or pasting: wait for a pause, then look the address up. Changing an
  // existing QR's address does not touch its label unless asked to.
  function onUrlChange(value: string) {
    setUrl(value);
    setError(null);
    clearTimeout(timer.current);
    if (adding && !labelEdited.current && normalizePaymentLink(value.trim())) {
      timer.current = setTimeout(() => void lookup(value.trim(), false), 600);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(adding ? "/api/other-qrs" : `/api/other-qrs/${item.id}`, {
        method: adding ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), label: label.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "保存に失敗しました");
      }
      if (adding) {
        setUrl("");
        setLabel("");
        setHint(null);
        labelEdited.current = false;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item || !window.confirm(`「${item.label}」のQRを削除しますか?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/other-qrs/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "削除に失敗しました");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
      setSaving(false);
    }
  }

  const idBase = `other-${item?.id ?? "new"}`;
  const buttonLabel = adding ? "登録" : "変更を保存";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 border-t-4 border-t-neutral-800 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-800">{item ? item.label : "QRを追加"}</h3>

      {item && (
        <button
          type="button"
          onClick={onZoom}
          aria-label={`${item.label}のQRを拡大`}
          className="mx-auto w-full max-w-64 rounded-lg border border-neutral-200 p-1"
        >
          <QrImage src={item.qr} kind={`other-${item.id}`} label={item.label} className="w-full" />
        </button>
      )}

      {canEdit && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-neutral-600" htmlFor={`${idBase}-url`}>
            リンク(https://…)
          </label>
          <input
            id={`${idBase}-url`}
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://"
            maxLength={500}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <QrScanner
            label={item?.label ?? "その他のQR"}
            onRead={(text) => {
              const read = normalizePaymentLink(text);
              if (!read) {
                setError("読み取ったQRは https:// で始まるリンクではありませんでした");
                return;
              }
              setError(null);
              setUrl(read);
              clearTimeout(timer.current);
              if (adding && !labelEdited.current) void lookup(read, false);
            }}
          />

          <label className="mt-1 text-xs font-medium text-neutral-600" htmlFor={`${idBase}-label`}>
            ラベル
          </label>
          <div className="flex gap-2">
            <input
              id={`${idBase}-label`}
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                labelEdited.current = true;
                setError(null);
              }}
              placeholder={looking ? "取得中…" : "例: アンケート"}
              maxLength={OTHER_QR_LABEL_MAX}
              className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={looking || !normalizePaymentLink(url.trim())}
              onClick={() => void lookup(url.trim(), true)}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-40"
            >
              {looking ? "取得中…" : "サイトから取得"}
            </button>
          </div>
          {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !dirty || !ready}
              onClick={() => void save()}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {saving ? "保存中…" : buttonLabel}
            </button>
            {item && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove()}
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
