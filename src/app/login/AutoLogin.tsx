"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loginWithPassword } from "./LoginForm";

// Handles /login?password=xxx : logs in immediately and redirects to /order,
// so a distributed link+password never needs to touch the manual form.
export default function AutoLogin({ password }: { password: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loginWithPassword(password)
      .then(() => {
        if (!cancelled) {
          router.replace("/order");
          router.refresh();
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "ログインに失敗しました");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  if (error) {
    return <p className="text-sm text-red-600">{error}(URLのパスワードが違います)</p>;
  }
  return <p className="text-sm text-neutral-500">ログイン中...</p>;
}
