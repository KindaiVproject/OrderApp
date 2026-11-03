import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logEdit } from "@/lib/editLog";
import { getCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { ORDER_SOUNDS, isOrderSoundId } from "@/lib/orderSound";
import { prisma } from "@/lib/prisma";

// The current instance's order sound. Every member's kitchen screen polls the
// GET so a change shows up on all devices without a reload.
export async function GET() {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ id: instance.orderSound });
}

// Change it. Instance admins (of this instance) and Admin only, like the
// payment links; members can still choose their own volume on their device.
export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  const instance = await getCurrentInstance();
  if (!instance || !(await isInstanceAdmin(instance.id, email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isOrderSoundId(body?.id)) {
    return NextResponse.json({ error: "音の種類が正しくありません" }, { status: 400 });
  }
  const id = body.id;
  if (instance.orderSound === id) return NextResponse.json({ ok: true, id });

  await prisma.instance.update({ where: { id: instance.id }, data: { orderSound: id } });
  const label = (sound: string) => ORDER_SOUNDS.find((s) => s.id === sound)?.label ?? sound;
  await logEdit({
    instanceId: instance.id,
    entityType: "INSTANCE",
    entityId: instance.id,
    action: "EDIT",
    summary: `注文の追加音を「${label(instance.orderSound)}」から「${label(id)}」に変更しました`,
    actorEmail: email,
  });
  return NextResponse.json({ ok: true, id });
}
