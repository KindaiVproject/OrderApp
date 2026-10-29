"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type Status = "loading" | "unsupported" | "unconfigured" | "denied" | "off" | "on";

export default function NotificationSettings({
  vapidPublicKey,
  initialReminder30,
}: {
  vapidPublicKey: string;
  initialReminder30: boolean;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [reminder30, setReminder30] = useState(initialReminder30);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function detect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus("unsupported");
        return;
      }
      if (!vapidPublicKey) {
        setStatus("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub && Notification.permission === "granted" ? "on" : "off");
    }
    detect();
  }, [vapidPublicKey]);

  async function enable() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("通知の登録に失敗しました");
      setStatus("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "通知の登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("通知を解除できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "テスト通知に失敗しました");
      setMessage(data.sent > 0 ? "テスト通知を送りました" : "送信先がありません。いったん通知をオフ→オンにしてください");
    } catch (e) {
      setError(e instanceof Error ? e.message : "テスト通知に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function toggleReminder(next: boolean) {
    setReminder30(next);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftReminder30: next }),
    });
    if (!res.ok) {
      setReminder30(!next);
      setError("設定を保存できませんでした");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-800">シフトの通知</h2>

      {status === "unsupported" && (
        <p className="text-xs leading-relaxed text-neutral-500">
          このブラウザは通知に対応していません。iPhone / iPad は、Safari の共有メニューから「ホーム画面に追加」したアプリで開くと使えます(iOS 16.4 以降)。
        </p>
      )}
      {status === "unconfigured" && (
        <p className="text-xs leading-relaxed text-neutral-500">サーバー側の通知設定がまだ入っていません。管理者に連絡してください。</p>
      )}
      {status === "denied" && (
        <p className="text-xs leading-relaxed text-neutral-500">
          このブラウザでは通知がブロックされています。ブラウザのサイト設定で通知を「許可」に変えてから、ページを開き直してください。
        </p>
      )}
      {(status === "off" || status === "on") && (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              status === "on" ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"
            }`}
          >
            {status === "on" ? "この端末で通知オン" : "この端末で通知オフ"}
          </span>
          <button
            type="button"
            onClick={status === "on" ? disable : enable}
            disabled={busy}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {status === "on" ? "通知をオフにする" : "通知をオンにする"}
          </button>
          {status === "on" && (
            <button
              type="button"
              onClick={sendTest}
              disabled={busy}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:opacity-40"
            >
              テスト通知
            </button>
          )}
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={reminder30}
          onChange={(e) => toggleReminder(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          シフト開始の30分前にも通知する
          <span className="block text-[11px] text-neutral-500">開始時刻の通知は、通知をオンにしていれば常に届きます。</span>
        </span>
      </label>

      {message && <p className="text-xs text-green-600">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
