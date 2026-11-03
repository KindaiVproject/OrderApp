"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const CHECK_INTERVAL_MS = 60_000;
// After "あとで", ask again once this long has passed (still on the old version).
const SNOOZE_MS = 10 * 60_000;

// Every modal/full-screen overlay in the app is a `fixed inset-0` element.
const OVERLAY_SELECTOR = ".fixed.inset-0";

// Tells people a newer version of the app has been deployed and offers to
// reload. It never reloads by itself, and it stays out of the way on the order
// screen and while a popup is open (someone is in the middle of something); it
// shows up once they're done.
export default function UpdateNotice() {
  const [outdated, setOutdated] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const pathname = usePathname();
  const onOrderScreen = pathname === "/order" || pathname.startsWith("/order/");

  useEffect(() => {
    const update = () => setOverlayOpen(document.querySelector(OVERLAY_SELECTOR) !== null);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const current = process.env.NEXT_PUBLIC_APP_VERSION;
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.version === "string" && data.version !== current) setOutdated(true);
      } catch {
        // offline or a transient error: try again at the next check
      }
    }

    const timer = setInterval(check, CHECK_INTERVAL_MS);
    // Coming back to the tab/app is when a stale page is most likely to matter.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Wake up when the snooze runs out so the notice comes back.
  useEffect(() => {
    if (!outdated || snoozedUntil === 0) return;
    const timer = setTimeout(() => setSnoozedUntil(0), Math.max(0, snoozedUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [outdated, snoozedUntil]);

  if (!outdated || snoozedUntil > 0 || onOrderScreen || overlayOpen) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white shadow-lg">
        <p className="flex-1 text-sm">
          <span className="font-semibold">新しいバージョンがあります。</span>
          <span className="block text-xs text-neutral-300">再読み込みすると最新になります。</span>
        </p>
        <button
          type="button"
          onClick={() => setSnoozedUntil(Date.now() + SNOOZE_MS)}
          className="rounded px-2 py-1.5 text-xs text-neutral-300"
        >
          あとで
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}
