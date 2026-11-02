import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logEdit } from "@/lib/editLog";
import { getCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { PAYMENT_LINK_KINDS, normalizePaymentLink } from "@/lib/paymentLinks";
import { prisma } from "@/lib/prisma";

// Register / change / clear the current instance's PayPay and d払い links.
// Instance admins (of this instance) and Admin only; members just view them.
export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  const instance = await getCurrentInstance();
  if (!instance || !(await isInstanceAdmin(instance.id, email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const kind = PAYMENT_LINK_KINDS.find((k) => k.kind === body?.kind);
  if (!kind) return NextResponse.json({ error: "種類が正しくありません" }, { status: 400 });

  const url = normalizePaymentLink(body?.url);
  if (url === null) {
    return NextResponse.json(
      { error: "https:// で始まる決済リンクを500文字以内で入力してください" },
      { status: 400 },
    );
  }

  const before = instance[kind.field];
  if (before === url) return NextResponse.json({ ok: true, url });
  await prisma.instance.update({ where: { id: instance.id }, data: { [kind.field]: url } });

  const verb = url === "" ? "を削除しました" : before === "" ? "を登録しました" : "を変更しました";
  await logEdit({
    instanceId: instance.id,
    entityType: "INSTANCE",
    entityId: instance.id,
    action: url === "" ? "DELETE" : before === "" ? "CREATE" : "EDIT",
    summary: `${kind.label}の決済リンク${verb}`,
    actorEmail: email,
  });
  return NextResponse.json({ ok: true, url });
}
