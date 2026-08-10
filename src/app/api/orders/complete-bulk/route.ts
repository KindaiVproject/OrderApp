import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment";
import type { PaymentMethod } from "@generated/prisma/enums";

export async function POST(request: Request) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const session = await auth();

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "対象の注文を選択してください" }, { status: 400 });
  }

  const targets = await prisma.order.findMany({
    where: { id: { in: ids }, instanceId: instance.id, status: "WAITING" },
  });

  await prisma.order.updateMany({
    where: { id: { in: ids }, instanceId: instance.id, status: "WAITING" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await Promise.all(
    targets.map((order) =>
      logEdit({
        instanceId: instance.id,
        entityType: "ORDER",
        entityId: order.id,
        action: "COMPLETE",
        summary: `まとめて提供完了(支払い方法: ${PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]})`,
        actorEmail: session?.user?.email,
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
