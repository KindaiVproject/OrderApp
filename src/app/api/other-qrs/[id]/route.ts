import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logEdit } from "@/lib/editLog";
import { getCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { OTHER_QR_LABEL_MAX, normalizeOtherQrLabel } from "@/lib/otherQr";
import { normalizePaymentLink } from "@/lib/paymentLinks";
import { prisma } from "@/lib/prisma";

// Change or delete one of the current instance's extra QRs (instance admins
// and Admin only). The link itself is not written to the edit log.
async function authorize() {
  const session = await auth();
  const email = session?.user?.email;
  const instance = await getCurrentInstance();
  if (!instance || !(await isInstanceAdmin(instance.id, email))) return null;
  return { instance, email };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await authorize();
  if (!who) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const { id } = await params;
  const qr = await prisma.otherQr.findFirst({ where: { id, instanceId: who.instance.id } });
  if (!qr) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const url = normalizePaymentLink(body?.url);
  if (!url) {
    return NextResponse.json({ error: "https:// で始まるリンクを500文字以内で入力してください" }, { status: 400 });
  }
  const label = normalizeOtherQrLabel(body?.label);
  if (!label) {
    return NextResponse.json({ error: `ラベルを${OTHER_QR_LABEL_MAX}文字以内で入力してください` }, { status: 400 });
  }
  if (label === qr.label && url === qr.url) return NextResponse.json({ ok: true });

  await prisma.otherQr.update({ where: { id: qr.id }, data: { label, url } });
  const parts = [
    ...(label !== qr.label ? [`ラベルを「${qr.label}」から「${label}」に`] : []),
    ...(url !== qr.url ? ["リンクを"] : []),
  ];
  await logEdit({
    instanceId: who.instance.id,
    entityType: "INSTANCE",
    entityId: who.instance.id,
    action: "EDIT",
    summary: `その他のQR「${label}」の${parts.join("、")}変更しました`,
    actorEmail: who.email,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await authorize();
  if (!who) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const { id } = await params;
  const qr = await prisma.otherQr.findFirst({ where: { id, instanceId: who.instance.id } });
  if (!qr) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.otherQr.delete({ where: { id: qr.id } });
  await logEdit({
    instanceId: who.instance.id,
    entityType: "INSTANCE",
    entityId: who.instance.id,
    action: "DELETE",
    summary: `その他のQR「${qr.label}」を削除しました`,
    actorEmail: who.email,
  });
  return NextResponse.json({ ok: true });
}
