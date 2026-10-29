"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";

export type DeletionInfo = {
  isAdmin: boolean;
  instanceNames: string[];
  assignments: number;
  devices: number;
};

// Account deletion, built so it can't happen by accident:
//  - it sits apart at the very bottom, in its own red section;
//  - the button only opens a confirmation, and cancelling is the default;
//  - the confirmation spells out exactly what goes, for this account;
//  - deleting needs the account's own email typed out AND a tick in a checkbox;
//  - the server checks the typed email again (and refuses Admin accounts).
export default function DeleteAccountSection({
  email,
  name,
  image,
  info,
}: {
  email: string;
  name: string;
  image: string | null;
  info: DeletionInfo;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus lands on "キャンセル", so a stray Enter / Space can't delete.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Esc backs out of the dialog.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setOpen(false);
        setTyped("");
        setUnderstood(false);
        setError(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setUnderstood(false);
    setError(null);
  }

  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const canDelete = matches && understood && !busy;

  async function deleteAccount() {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "削除に失敗しました");
        setBusy(false);
        return;
      }
      // The account and its sessions are gone; this also clears the cookie.
      await signOut({ callbackUrl: "/login" });
    } catch {
      setError("削除に失敗しました。通信を確認してもう一度お試しください");
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 flex flex-col gap-2 rounded-lg border border-red-200 bg-white p-3 shadow-sm">
      <h2 className="text-sm font-semibold text-red-700">アカウントの削除</h2>
      {info.isAdmin ? (
        <p className="text-xs leading-relaxed text-neutral-500">
          Admin権限のあるアカウントは、ここからは削除できません。削除したい場合は、先に別のAdminにAdmin権限を外してもらってください。
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-neutral-500">
            このアカウントと、参加しているインスタンスからの登録を削除します。取り消せません。
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-start rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            アカウントを削除する…
          </button>
        </>
      )}

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl"
          >
            <h3 id="delete-account-title" className="text-base font-semibold text-red-700">
              アカウントを削除しますか？
            </h3>

            <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2">
              <Avatar name={name} image={image} size={36} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-neutral-800">{name}</span>
                <span className="truncate text-xs text-neutral-500">{email}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-neutral-700">
              <p className="font-semibold text-neutral-800">次のものが削除されます</p>
              <ul className="list-disc pl-5">
                <li>このアカウントと、Googleアカウントとの連携・ログイン状態</li>
                <li>
                  参加中のインスタンスからの登録(
                  {info.instanceNames.length > 0 ? info.instanceNames.join("、") : "なし"})
                </li>
                <li>シフトの担当 {info.assignments}件</li>
                <li>通知の登録 {info.devices}台と、表示名などの本人の設定</li>
              </ul>
              <p className="font-semibold text-neutral-800">削除されないもの</p>
              <ul className="list-disc pl-5">
                <li>注文・商品など、各インスタンスの記録</li>
                <li>編集履歴にある「誰が操作したか」の記録(管理のため残ります)</li>
              </ul>
              <p className="rounded bg-red-50 p-2 font-semibold text-red-700">
                この操作は取り消せません。同じGoogleアカウントで再びログインしても、データは戻らず、インスタンスにはもう一度招待してもらう必要があります。
              </p>
            </div>

            <label className="flex flex-col gap-1 text-xs text-neutral-600">
              確認のため、このアカウントのメールアドレスを入力してください
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={email}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="email"
                className={`rounded border px-2 py-1.5 text-sm ${
                  typed && !matches ? "border-red-300" : "border-neutral-300"
                }`}
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              上の内容を理解し、アカウントを削除します
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={!canDelete}
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy ? "削除中…" : "完全に削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
