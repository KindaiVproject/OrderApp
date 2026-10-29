"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-lg border border-red-200 bg-white px-3 py-2.5 text-center text-sm font-medium text-red-600 shadow-sm hover:bg-red-50"
    >
      ログアウト
    </button>
  );
}
