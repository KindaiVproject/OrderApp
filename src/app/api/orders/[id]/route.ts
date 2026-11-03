import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";
import { change, snapshotOf } from "@/lib/revert";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment";
import type { PaymentMethod } from "@generated/prisma/enums";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "PAYPAY", "D_PAYMENT"];

function itemsSummary(items: { productName: string; quantity: number }[]) {
  return items.map((i) => `${i.productName}×${i.quantity}`).join(", ");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, instanceId: instance.id },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const session = await auth();

  const existing = await prisma.order.findFirst({
    where: { id, instanceId: instance.id },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json().catch(() => null);

  // 不明 is only for completed orders (set from the history edit); an order that
  // is already 不明 may keep it when something else is edited.
  const paymentAllowed =
    PAYMENT_METHODS.includes(body?.paymentMethod) ||
    body?.paymentMethod === existing.paymentMethod ||
    (body?.paymentMethod === "UNKNOWN" && existing.status === "COMPLETED");
  if (body?.paymentMethod !== undefined && !paymentAllowed) {
    return NextResponse.json({ error: "支払い方法が不正です" }, { status: 400 });
  }

  let itemsUpdate = undefined;
  if (Array.isArray(body?.items)) {
    const productIds = body.items.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, instanceId: instance.id },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const servedByProduct = new Map<string, number>();
    for (const i of existing.items) {
      if (i.productId) servedByProduct.set(i.productId, (servedByProduct.get(i.productId) ?? 0) + i.servedQuantity);
    }
    const orderItems = [];
    for (const item of body.items) {
      const product = productMap.get(item.productId);
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity <= 0) {
        return NextResponse.json({ error: "注文内容が不正です" }, { status: 400 });
      }
      orderItems.push({
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        unitPrice: product.price,
        quantity,
        // Keep what was already handed over for a product that stays in the order.
        servedQuantity: Math.min(servedByProduct.get(product.id) ?? 0, quantity),
      });
    }
    if (orderItems.length === 0) {
      return NextResponse.json({ error: "商品を1つ以上選択してください" }, { status: 400 });
    }
    itemsUpdate = orderItems;
  }

  const before = await snapshotOf("ORDER", id, instance.id);
  const order = await prisma.$transaction(async (tx) => {
    if (itemsUpdate) {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
    }
    return tx.order.update({
      where: { id },
      data: {
        ...(body?.customerNote !== undefined
          ? { customerNote: String(body.customerNote).trim() || null }
          : {}),
        ...(body?.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod } : {}),
        ...(itemsUpdate ? { items: { create: itemsUpdate } } : {}),
      },
      include: { items: true },
    });
  });

  const changes: string[] = [];
  if (body?.customerNote !== undefined) {
    const newNote = String(body.customerNote).trim() || null;
    if (newNote !== existing.customerNote) {
      changes.push(`客の特徴: 「${existing.customerNote ?? ""}」→「${newNote ?? ""}」`);
    }
  }
  if (body?.paymentMethod !== undefined && body.paymentMethod !== existing.paymentMethod) {
    changes.push(
      `支払い方法: ${PAYMENT_METHOD_LABELS[existing.paymentMethod as PaymentMethod]} → ${PAYMENT_METHOD_LABELS[body.paymentMethod as PaymentMethod]}`,
    );
  }
  if (itemsUpdate) {
    changes.push(`商品: ${itemsSummary(existing.items)} → ${itemsSummary(itemsUpdate)}`);
  }
  if (changes.length > 0) {
    await logEdit({
      instanceId: instance.id,
      entityType: "ORDER",
      entityId: id,
      action: "EDIT",
      summary: changes.join(" / "),
      actorEmail: session?.user?.email,
      changes: [change("ORDER", id, before, await snapshotOf("ORDER", id, instance.id))],
    });
  }

  return NextResponse.json(order);
}

// "Make it as if the order never happened": removes a completed order for good
// (it leaves the history, the CSV and the sales figures). Instance admins only.
// Logged with the before state, so the edit log can bring it back.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const instance = await getCurrentInstance();
  if (!instance || !(await isInstanceAdmin(instance.id, session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  const existing = await prisma.order.findFirst({
    where: { id, instanceId: instance.id },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.status !== "COMPLETED") {
    return NextResponse.json({ error: "完了済みの注文だけ削除できます" }, { status: 400 });
  }

  const before = await snapshotOf("ORDER", id, instance.id);
  await prisma.order.delete({ where: { id } });

  await logEdit({
    instanceId: instance.id,
    entityType: "ORDER",
    entityId: id,
    action: "DELETE",
    summary: `完了済みの注文を削除(なかったことにしました): ${itemsSummary(existing.items)} / ${PAYMENT_METHOD_LABELS[existing.paymentMethod as PaymentMethod]}`,
    actorEmail: session?.user?.email,
    changes: [change("ORDER", id, before, null)],
  });
  return NextResponse.json({ ok: true });
}
