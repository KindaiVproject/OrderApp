"use client";

import { useEffect, useRef, useState } from "react";
import { decodeQrFromFile, decodeQrFromVideo } from "@/lib/qrScan";

// Reads a QR code, by camera or from an image, and hands its text to onRead.
// It never saves anything itself: the caller puts the text in the input and
// the person still presses 登録.
export default function QrScanner({
  label,
  onRead,
}: {
  label: string;
  onRead: (text: string) => void;
}) {
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage("読み取り中…");
    try {
      const text = await decodeQrFromFile(file);
      if (text) {
        setMessage(null);
        onRead(text);
      } else {
        setMessage("QRを読み取れませんでした。QRが大きく写った画像を選んでください");
      }
    } catch {
      setMessage("画像を開けませんでした");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setCamera(true);
          }}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
        >
          カメラでQRを読み取る
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
        >
          QR画像から読み取る
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {message && <p className="text-xs text-neutral-500">{message}</p>}

      {camera && (
        <CameraModal
          label={label}
          onClose={() => setCamera(false)}
          onRead={(text) => {
            setCamera(false);
            onRead(text);
          }}
        />
      )}
    </div>
  );
}

function CameraModal({
  label,
  onClose,
  onRead,
}: {
  label: string;
  onClose: () => void;
  onRead: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Keep the latest callback without restarting the camera when it changes.
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("この端末・ブラウザではカメラを使えません。「QR画像から読み取る」を使ってください");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setError("カメラを使えませんでした。ブラウザのカメラ許可を確認するか、「QR画像から読み取る」を使ってください");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      async function tick() {
        if (stopped || !video || !canvasRef.current) return;
        if (video.readyState >= 2) {
          const text = await decodeQrFromVideo(video, canvasRef.current).catch(() => null);
          if (text && !stopped) {
            onReadRef.current(text);
            return;
          }
        }
        timer = setTimeout(tick, 200);
      }
      tick();
    }
    start();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4">
      <p className="text-sm font-semibold text-white">{label}のQRを枠に写してください</p>
      {error ? (
        <p className="max-w-sm rounded-lg bg-white p-4 text-sm text-red-600">{error}</p>
      ) : (
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-square w-full max-w-sm rounded-xl bg-black object-cover"
        />
      )}
      <canvas ref={canvasRef} className="hidden" />
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-800"
      >
        閉じる
      </button>
    </div>
  );
}
