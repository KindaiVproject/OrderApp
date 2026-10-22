"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-center text-xs text-neutral-500 underline"
    >
      ログアウト
    </button>
  );
}
