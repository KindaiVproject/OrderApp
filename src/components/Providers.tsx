"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

// Blocks the browser's long-press context menu (save image / open in new
// tab / copy image) on <img> elements. -webkit-touch-callout: none in
// globals.css covers iOS Safari; Android Chrome fires a real contextmenu
// event on long-press instead, which this catches.
function useBlockImageContextMenu() {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (e.target instanceof HTMLImageElement) {
        e.preventDefault();
      }
    }
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useBlockImageContextMenu();
  return <SessionProvider>{children}</SessionProvider>;
}
