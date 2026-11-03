import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";
import { change, snapshotOf } from "@/lib/revert";

// Send a completed order back to the kitchen (差し戻し): it is waiting again and
// nothing counts as handed over. Instance admins only. Works on any completed
// order, including ones completed before this existed.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const instance = await getCurrentInstance();
  if (!instance || !(await isInstanceAdmin(instance.id, session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  const existing = await prisma.order.findFirst({ where: { id, instanceId: instance.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.status !== "COMPLETED") {
    return NextResponse.json({ error: "完了済みの注文だけ差し戻せます" }, { status: 400 });
  }

  const before = await snapshotOf("ORDER", id, instance.id);
  const order = await prisma.$transaction(async (tx) => {
    await tx.orderItem.updateMany({ where: { orderId: id }, data: { servedQuantity: 0 } });
    return tx.order.update({
      where: { id },
      data: { status: "WAITING", completedAt: null },
      include: { items: true },
    });
  });

  await logEdit({
    instanceId: instance.id,
    entityType: "ORDER",
    entityId: id,
    action: "EDIT",
    summary: "完了済みの注文を差し戻し(待機中に戻しました)",
    actorEmail: session?.user?.email,
    changes: [change("ORDER", id, before, await snapshotOf("ORDER", id, instance.id))],
  });

  return NextResponse.json(order);
}
