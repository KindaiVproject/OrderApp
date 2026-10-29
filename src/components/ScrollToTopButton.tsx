"use client";

import { useEffect, useState } from "react";

// Floating "back to top" button for long pages (kitchen, order history). It
// appears once the page has been scrolled a bit and scrolls smoothly back up.
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="ページの先頭へ戻る"
      className="fixed bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-300 bg-white text-lg text-neutral-700 shadow-lg hover:bg-neutral-50 active:bg-neutral-100"
    >
      ↑
    </button>
  );
}
