import { NextResponse } from "next/server";
import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@generated/prisma/enums";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "PAYPAY", "D_PAYMENT"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.order.findFirst({ where: { id, instanceId: instance.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const paymentMethod: PaymentMethod | undefined = PAYMENT_METHODS.includes(body?.paymentMethod)
    ? body.paymentMethod
    : undefined;

  const order = await prisma.order.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      ...(paymentMethod ? { paymentMethod } : {}),
    },
    include: { items: true },
  });
  return NextResponse.json(order);
}
