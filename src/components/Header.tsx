"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/order", label: "注文" },
  { href: "/kitchen", label: "厨房" },
  { href: "/history", label: "注文履歴" },
  { href: "/products", label: "商品" },
];

export default function Header({ orgLabel }: { orgLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
      <span className="mr-1 text-sm font-semibold text-neutral-800">Order Management</span>
      {orgLabel && (
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
          {orgLabel}
        </span>
      )}
      <nav className="flex flex-wrap items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded px-2 py-1 text-xs font-medium ${
              pathname === item.href
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={handleLogout}
        className="ml-auto rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
      >
        ログアウト
      </button>
    </header>
  );
}
