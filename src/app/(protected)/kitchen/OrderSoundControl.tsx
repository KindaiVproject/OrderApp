"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ORDER_SOUNDS,
  isAudioRunning,
  onAudioStateChange,
  playOrderSound,
  unlockAudio,
  type OrderSoundId,
  type OrderSoundSettings,
} from "@/lib/orderSound";

// "Order sound" button for the kitchen header: pick the chime, set the volume,
// and listen to it. Tapping anything here also unlocks audio for the page.
export default function OrderSoundControl({
  settings,
  onChange,
}: {
  settings: OrderSoundSettings;
  onChange: (next: OrderSoundSettings) => void;
}) {
  const [open, setOpen] = useState(false);
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

  async function preview(id: OrderSoundId, volume: number) {
    if (await unlockAudio()) playOrderSound(id, volume);
  }

  const current = ORDER_SOUNDS.find((s) => s.id === settings.id);
  const muted = settings.id === "none";
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
        {muted ? "音なし" : (current?.label ?? "")}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
          <h2 className="mb-2 text-sm font-semibold text-neutral-800">注文が入ったときの音</h2>
          <ul className="flex flex-col gap-1">
            {ORDER_SOUNDS.map((s) => (
              <li key={s.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 ${
                    settings.id === s.id ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="order-sound"
                    checked={settings.id === s.id}
                    onChange={() => {
                      onChange({ ...settings, id: s.id });
                      void preview(s.id, settings.volume);
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
                        void preview(s.id, settings.volume);
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

          <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
            音量
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              disabled={muted}
              onChange={(e) => onChange({ ...settings, volume: Number(e.target.value) })}
              onPointerUp={() => void preview(settings.id, settings.volume)}
              onKeyUp={() => void preview(settings.id, settings.volume)}
              className="flex-1"
            />
          </label>

          {locked && (
            <p className="mt-2 text-[11px] text-amber-700">
              このページでまだ音が許可されていません。「試聴」を一度押すと鳴るようになります。
            </p>
          )}
          <p className="mt-2 text-[11px] text-neutral-400">この端末だけの設定です。</p>
        </div>
      )}
    </div>
  );
}
