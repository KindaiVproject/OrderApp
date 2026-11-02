"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";

export default function RevertButton({ logId, summary, isRevert }: { logId: string; summary: string; isRevert: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function revert() {
    const res = await fetch(`/api/edit-log/${logId}/revert`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "取り消しに失敗しました");
    setOpen(false);
    if (data?.skippedMembers > 0) {
      window.alert(`取り消しました。ただし、すでにメンバーから外れている ${data.skippedMembers} 人の担当は戻せませんでした。`);
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
      >
        {isRevert ? "やっぱり元に戻す" : "取り消す"}
      </button>
      {open && (
        <ConfirmModal
          title={isRevert ? "取り消しをやり直しますか?" : "この変更を取り消しますか?"}
          message={`「${summary}」を、変更前の状態に戻します。この操作も編集履歴に記録され、あとから元に戻せます。`}
          confirmLabel={isRevert ? "やり直す" : "取り消す"}
          danger={false}
          onConfirm={revert}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
