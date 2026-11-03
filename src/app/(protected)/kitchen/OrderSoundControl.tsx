"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ORDER_SOUNDS,
  isAudioRunning,
  onAudioStateChange,
  playOrderSound,
  speakOrders,
  speechSupported,
  unlockAudio,
  type OrderSoundId,
} from "@/lib/orderSound";

// "Order sound" button for the kitchen header: pick the chime, set the volume,
// and listen to it. Tapping anything here also unlocks audio for the page.
export default function OrderSoundControl({
  soundId,
  volume,
  speech,
  canEdit,
  onChangeSound,
  onChangeVolume,
  onChangeSpeech,
}: {
  soundId: OrderSoundId;
  volume: number;
  // Read the order's products and quantities aloud (this device only).
  speech: boolean;
  // Which sound rings is the instance's setting; only instance admins can change it.
  canEdit: boolean;
  // Resolves to an error message, or null when saved.
  onChangeSound: (id: OrderSoundId) => Promise<string | null>;
  onChangeVolume: (volume: number) => void;
  onChangeSpeech: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useSyncExternalStore(onAudioStateChange, isAudioRunning, () => false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Reads a made-up order, so the voice and volume can be checked.
  async function sample() {
    await unlockAudio();
    speakOrders(
      [[{ productName: "たこ焼き", quantity: 2 }, { productName: "ラムネ", quantity: 1 }]],
      volume,
      "none",
    );
  }

  async function preview(id: OrderSoundId, volume: number) {
    if (await unlockAudio()) playOrderSound(id, volume);
  }

  const current = ORDER_SOUNDS.find((s) => s.id === soundId);
  const canSpeak = speechSupported();
  const muted = (soundId === "none" && !(speech && canSpeak)) || volume === 0;
  // Sound is on but the browser hasn't allowed it yet (needs one tap on the page).
  const locked = !muted && !running;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          void unlockAudio();
        }}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm ${
          muted
            ? "border-neutral-200 bg-white text-neutral-400"
            : locked
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-neutral-300 bg-white text-neutral-700"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
          {muted ? (
            <path d="m16 9 5 6m0-6-5 6" strokeLinecap="round" />
          ) : (
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
          )}
        </svg>
        {volume === 0
          ? "消音"
          : soundId === "none"
            ? speech && canSpeak
              ? "読み上げのみ"
              : "音なし"
            : `${current?.label ?? ""}${speech && canSpeak ? " + 読み上げ" : ""}`}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
          <h2 className="mb-0.5 text-sm font-semibold text-neutral-800">注文が入ったときの音</h2>
          <p className="mb-2 text-[11px] text-neutral-500">
            {canEdit
              ? "選んだ音は、このインスタンスの全員の厨房画面で鳴ります。"
              : "音の種類はインスタンスの管理者が決めています。"}
          </p>
          <ul className="flex flex-col gap-1">
            {ORDER_SOUNDS.map((s) => (
              <li key={s.id}>
                <label
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                    soundId === s.id ? "bg-neutral-100" : canEdit ? "cursor-pointer hover:bg-neutral-50" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="order-sound"
                    checked={soundId === s.id}
                    disabled={!canEdit}
                    onChange={async () => {
                      setError(null);
                      void preview(s.id, volume);
                      setError(await onChangeSound(s.id));
                    }}
                  />
                  <span className="flex-1">
                    <span className="block text-sm text-neutral-800">{s.label}</span>
                    {s.note && <span className="block text-[11px] text-neutral-500">{s.note}</span>}
                  </span>
                  {s.id !== "none" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        void preview(s.id, volume);
                      }}
                      className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-50"
                    >
                      試聴
                    </button>
                  )}
                </label>
              </li>
            ))}
          </ul>
          {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}

          <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
            音量
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onChangeVolume(Number(e.target.value))}
              onPointerUp={() => void preview(soundId, volume)}
              onKeyUp={() => void preview(soundId, volume)}
              className="flex-1"
            />
          </label>
          <p className="mt-1 text-[11px] text-neutral-400">音量はこの端末だけの設定です。</p>

          <div className="mt-3 border-t border-neutral-200 pt-3">
            <label className={`flex items-start gap-2 ${canSpeak ? "cursor-pointer" : "opacity-50"}`}>
              <input
                type="checkbox"
                checked={speech && canSpeak}
                disabled={!canSpeak}
                onChange={(e) => {
                  onChangeSpeech(e.target.checked);
                  if (e.target.checked) void sample();
                }}
                className="mt-0.5"
              />
              <span className="flex-1">
                <span className="block text-sm text-neutral-800">注文内容を読み上げる</span>
                <span className="block text-[11px] text-neutral-500">
                  {canSpeak
                    ? "音のあとに、商品と個数を声で読みます(この端末だけの設定)。"
                    : "この端末のブラウザは読み上げに対応していません。"}
                </span>
              </span>
            </label>
            {canSpeak && (
              <button
                type="button"
                onClick={() => void sample()}
                className="mt-1.5 rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-50"
              >
                試し読み
              </button>
            )}
          </div>

          {locked && (
            <p className="mt-2 text-[11px] text-amber-700">
              このページでまだ音が許可されていません。「試聴」を一度押すと鳴るようになります。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
