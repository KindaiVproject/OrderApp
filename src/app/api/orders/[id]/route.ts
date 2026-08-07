import { NextResponse } from "next/server";
import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@generated/prisma/enums";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "PAYPAY", "D_PAYMENT"];

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

  const existing = await prisma.order.findFirst({ where: { id, instanceId: instance.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json().catch(() => null);

  if (body?.paymentMethod !== undefined && !PAYMENT_METHODS.includes(body.paymentMethod)) {
    return NextResponse.json({ error: "支払い方法が不正です" }, { status: 400 });
  }

  let itemsUpdate = undefined;
  if (Array.isArray(body?.items)) {
    const productIds = body.items.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, instanceId: instance.id },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

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
        unitPrice: product.price,
        quantity,
      });
    }
    if (orderItems.length === 0) {
      return NextResponse.json({ error: "商品を1つ以上選択してください" }, { status: 400 });
    }
    itemsUpdate = orderItems;
  }

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

  return NextResponse.json(order);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.order.findFirst({ where: { id, instanceId: instance.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
