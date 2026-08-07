import { NextResponse } from "next/server";
import { getSessionOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { OrderStatus, PaymentMethod } from "@generated/prisma/enums";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "PAYPAY", "D_PAYMENT"];

export async function GET(request: Request) {
  const org = await getSessionOrg();
  if (!org) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as OrderStatus | null;

  const orders = await prisma.order.findMany({
    where: {
      orgId: org.id,
      ...(status ? { status } : {}),
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const org = await getSessionOrg();
  if (!org) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items : [];
  const customerNote = typeof body?.customerNote === "string" ? body.customerNote.trim() || null : null;
  const paymentMethod = body?.paymentMethod as PaymentMethod;

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return NextResponse.json({ error: "支払い方法を選択してください" }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "商品を1つ以上選択してください" }, { status: 400 });
  }

  const productIds = items.map((i: { productId: string }) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, orgId: org.id },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderItems = [];
  for (const item of items) {
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

  const order = await prisma.order.create({
    data: {
      orgId: org.id,
      customerNote,
      paymentMethod,
      items: { create: orderItems },
    },
    include: { items: true },
  });

  return NextResponse.json(order, { status: 201 });
}
