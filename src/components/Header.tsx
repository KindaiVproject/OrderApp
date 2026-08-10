"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/order", label: "注文" },
  { href: "/kitchen", label: "厨房" },
  { href: "/history", label: "注文履歴" },
  { href: "/products", label: "商品" },
  { href: "/stats", label: "統計" },
];

export default function Header({
  instanceName,
  instanceLabel,
  isAdmin,
}: {
  instanceName: string;
  instanceLabel: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  useEffect(() => {
    function measure() {
      const activeItem = NAV_ITEMS.find((item) => item.href === pathname);
      const el = activeItem ? linkRefs.current[activeItem.href] : null;
      if (el) {
        setIndicator({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <span className="mr-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
        <Image src="/logo.svg" alt="" width={20} height={20} className="rounded-[5px]" />
        注文管理
      </span>
      <span
        className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-bold text-white"
        title={instanceName}
      >
        {instanceLabel || instanceName}
      </span>
      <nav className="relative flex flex-wrap items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
        <span
          aria-hidden
          className={`absolute inset-y-1 rounded bg-neutral-900 shadow-sm transition-all duration-300 ease-out ${
            indicator.ready ? "opacity-100" : "opacity-0"
          }`}
          style={{ left: indicator.left, width: indicator.width }}
        />
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => {
                linkRefs.current[item.href] = el;
              }}
              className={`relative z-10 rounded px-2 py-1 text-xs font-medium transition-colors duration-200 ${
                active ? "text-white" : "text-neutral-700 hover:bg-white hover:shadow-sm"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
        <Link
          href="/instances"
          className="rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
        >
          切替
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
          >
            Admin
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        aria-label="ログアウト"
        title="ログアウト"
        className="ml-auto flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6.5 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.5 11l3-3-3-3M13.2 8H6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </header>
  );
}
