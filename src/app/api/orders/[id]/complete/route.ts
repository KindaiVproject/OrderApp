import { NextResponse } from "next/server";
import { getSessionOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@generated/prisma/enums";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "PAYPAY", "D_PAYMENT"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getSessionOrg();
  if (!org) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.order.findFirst({ where: { id, orgId: org.id } });
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
