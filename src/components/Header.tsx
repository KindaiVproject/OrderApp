"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/order", label: "注文" },
  { href: "/kitchen", label: "厨房" },
  { href: "/history", label: "注文履歴" },
  { href: "/products", label: "商品" },
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

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
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
      </nav>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="ml-auto rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
      >
        ログアウト
      </button>
    </header>
  );
}
