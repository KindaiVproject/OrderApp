import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { formatJstDateTime } from "@/lib/datetime";

const ENTITY_LABELS: Record<string, string> = {
  ORDER: "注文",
  PRODUCT: "商品",
  MEMBER: "メンバー",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "新規登録",
  EDIT: "編集",
  CANCEL: "キャンセル",
  COMPLETE: "完了",
  DELETE: "削除",
  INVITE: "招待",
};

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-teal-100 text-teal-700",
  EDIT: "bg-blue-100 text-blue-700",
  CANCEL: "bg-red-100 text-red-700",
  COMPLETE: "bg-green-100 text-green-700",
  DELETE: "bg-neutral-200 text-neutral-600",
  INVITE: "bg-purple-100 text-purple-700",
};

export default async function EditLogPage() {
  const instance = await requireCurrentInstance();
  const session = await auth();
  const allowed = await isInstanceAdmin(instance.id, session?.user?.email);
  if (!allowed) redirect("/order");

  const logs = await prisma.editLog.findMany({
    where: { instanceId: instance.id },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-base font-semibold text-neutral-800">編集履歴</h1>
      <p className="text-xs text-neutral-500">
        注文・商品の登録/編集/キャンセル/完了/削除、メンバー招待の記録です。インスタンス管理者・管理者のみ閲覧できます。
      </p>

      <ul className="flex flex-col gap-2">
        {logs.map((log) => (
          <li key={log.id} className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
              <span>{formatJstDateTime(new Date(log.createdAt))}</span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600">
                {ENTITY_LABELS[log.entityType] ?? log.entityType}
              </span>
              <span className={`rounded px-1.5 py-0.5 font-medium ${ACTION_STYLES[log.action] ?? ""}`}>
                {ACTION_LABELS[log.action] ?? log.action}
              </span>
              <span>{log.actorEmail}</span>
            </div>
            <p className="mt-1 text-sm text-neutral-700">{log.summary}</p>
          </li>
        ))}
        {logs.length === 0 && <p className="text-sm text-neutral-400">まだ編集履歴がありません</p>}
      </ul>
    </div>
  );
}
