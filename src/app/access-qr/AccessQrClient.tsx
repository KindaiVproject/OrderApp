"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function AccessQrClient({ url, qr }: { url: string; qr: string }) {
  const [zoomed, setZoomed] = useState(false);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  const qrView = (className: string) => (
    <span className={`@container relative block aspect-square ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="アプリを開くQR" className="size-full [image-rendering:pixelated]" />
      <span className="absolute left-1/2 top-1/2 flex w-[22%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3cqw] bg-white p-[1.5cqw]">
        <Image src="/logo.svg" alt="" width={64} height={64} className="size-full rounded-[2cqw]" />
      </span>
    </span>
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col p-4">
      <div className="my-auto flex flex-col gap-4">
        <h1 className="text-base font-semibold text-neutral-800">アプリを開くQR</h1>
        <p className="text-xs text-neutral-500">
          スマホのカメラで読み取ると、このアプリが開きます。QRをタップすると拡大します。
        </p>

        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label="QRを拡大"
          className="mx-auto w-full max-w-72 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm"
        >
          {qrView("w-full")}
        </button>

        <p className="break-all text-center text-xs text-neutral-600">{url}</p>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-sm"
          >
            {copied === "ok" ? "コピーしました" : copied === "fail" ? "コピーできませんでした" : "URLをコピー"}
          </button>
          <a
            href={qr}
            download="app-access-qr.png"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-sm"
          >
            画像として保存
          </a>
        </div>

        <Link
          href="/instances"
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-center text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
        >
          トップへ戻る
        </Link>
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white p-4"
          onClick={() => setZoomed(false)}
        >
          {qrView("w-full max-w-[min(90vw,80vh)]")}
          <p className="text-xs text-neutral-500">どこかをタップして閉じる</p>
        </div>
      )}
    </div>
  );
}
