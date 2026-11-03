"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import UpdateNotice from "@/components/UpdateNotice";

// Locks pinch/double-tap/Ctrl+wheel/keyboard zoom and the context menu
// (right-click, long-press). The viewport meta (layout.tsx) and touch-action
// (globals.css) cover most browsers; iOS Safari ignores user-scalable=no, so
// its gesture events are cancelled here too. Browser-level zoom shortcuts
// are cancelled where the browser lets a page do so.
function useLockZoomAndMenu() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "_", "0"].includes(e.key)) e.preventDefault();
    };
    const opts = { passive: false } as const;
    document.addEventListener("contextmenu", stop);
    document.addEventListener("gesturestart", stop);
    document.addEventListener("gesturechange", stop);
    document.addEventListener("gestureend", stop);
    document.addEventListener("touchmove", onTouchMove, opts);
    window.addEventListener("wheel", onWheel, opts);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("gestureend", stop);
      document.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useLockZoomAndMenu();
  return (
    <SessionProvider>
      {children}
      <UpdateNotice />
    </SessionProvider>
  );
}
