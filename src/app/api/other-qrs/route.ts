import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logEdit } from "@/lib/editLog";
import { getCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { OTHER_QR_LABEL_MAX, OTHER_QR_MAX_COUNT, normalizeOtherQrLabel } from "@/lib/otherQr";
import { normalizePaymentLink } from "@/lib/paymentLinks";
import { prisma } from "@/lib/prisma";

// Register one more QR on /payment. Instance admins (of this instance) and
// Admin only, like the PayPay / d払い links.
export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  const instance = await getCurrentInstance();
  if (!instance || !(await isInstanceAdmin(instance.id, email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const url = normalizePaymentLink(body?.url);
  if (!url) {
    return NextResponse.json({ error: "https:// で始まるリンクを500文字以内で入力してください" }, { status: 400 });
  }
  const label = normalizeOtherQrLabel(body?.label);
  if (!label) {
    return NextResponse.json({ error: `ラベルを${OTHER_QR_LABEL_MAX}文字以内で入力してください` }, { status: 400 });
  }
  if ((await prisma.otherQr.count({ where: { instanceId: instance.id } })) >= OTHER_QR_MAX_COUNT) {
    return NextResponse.json({ error: `登録できるのは${OTHER_QR_MAX_COUNT}件までです` }, { status: 400 });
  }

  const created = await prisma.otherQr.create({ data: { instanceId: instance.id, label, url } });
  await logEdit({
    instanceId: instance.id,
    entityType: "INSTANCE",
    entityId: instance.id,
    action: "CREATE",
    summary: `その他のQR「${label}」を登録しました`,
    actorEmail: email,
  });
  return NextResponse.json({ ok: true, id: created.id });
}
