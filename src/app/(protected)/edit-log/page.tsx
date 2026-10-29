import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { MEMBER_INVITE_SUFFIX, MEMBER_ROLE_MARKER } from "@/lib/editLog";
import { resolveName } from "@/lib/memberName";
import { prisma } from "@/lib/prisma";
import { formatJstDateTime } from "@/lib/datetime";

const ENTITY_LABELS: Record<string, string> = {
  ORDER: "注文",
  PRODUCT: "商品",
  MEMBER: "メンバー",
  SHIFT: "シフト",
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

  // Names are resolved at render time (not stored in the log), so past
  // entries pick up names too. Same priority as the member lists: the
  // current member's per-instance name, then the account's, then the email.
  // Invite summaries carry the invitee's email, so people removed since can
  // still be matched to their account by email.
  const memberLogs = logs.filter((log) => log.entityType === "MEMBER");
  const inviteEmails = memberLogs
    .filter((log) => log.action === "INVITE" && log.summary.endsWith(MEMBER_INVITE_SUFFIX))
    .map((log) => log.summary.slice(0, -MEMBER_INVITE_SUFFIX.length));
  const actorEmails = [...new Set(logs.map((log) => log.actorEmail))];
  const lookupEmails = [...new Set([...actorEmails, ...inviteEmails])];
  const [members, users] = await Promise.all([
    prisma.instanceMember.findMany({
      where: {
        instanceId: instance.id,
        OR: [{ email: { in: lookupEmails } }, { id: { in: memberLogs.map((log) => log.entityId) } }],
      },
      include: { user: true },
    }),
    prisma.user.findMany({ where: { email: { in: lookupEmails } } }),
  ]);

  function label(email: string, member?: (typeof members)[number]) {
    const user = member?.user ?? users.find((u) => u.email === email);
    const name = resolveName(email, member?.displayName, user);
    return name === email ? email : `${name}(${email})`;
  }
  const actorLabels = new Map(
    actorEmails.map((email) => [email, label(email, members.find((m) => m.email === email))]),
  );

  function summaryOf(log: (typeof logs)[number]) {
    if (log.entityType !== "MEMBER") return log.summary;
    const member = members.find((m) => m.id === log.entityId);
    if (log.action === "INVITE" && log.summary.endsWith(MEMBER_INVITE_SUFFIX)) {
      const email = member?.email ?? log.summary.slice(0, -MEMBER_INVITE_SUFFIX.length);
      return `${label(email, member)}${MEMBER_INVITE_SUFFIX}`;
    }
    const at = log.summary.indexOf(MEMBER_ROLE_MARKER);
    if (member && at > 0) return `${label(member.email, member)}${log.summary.slice(at)}`;
    return log.summary;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-base font-semibold text-neutral-800">編集履歴</h1>
      <p className="text-xs text-neutral-500">
        注文・商品の登録/編集/キャンセル/完了/削除、シフト・メンバー招待の記録です。インスタンス管理者・管理者のみ閲覧できます。
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
              <span>{actorLabels.get(log.actorEmail) ?? log.actorEmail}</span>
            </div>
            <p className="mt-1 text-sm text-neutral-700">{summaryOf(log)}</p>
          </li>
        ))}
        {logs.length === 0 && <p className="text-sm text-neutral-400">まだ編集履歴がありません</p>}
      </ul>
    </div>
  );
}
