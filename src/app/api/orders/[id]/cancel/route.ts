import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const session = await auth();

  const existing = await prisma.order.findFirst({ where: { id, instanceId: instance.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.status === "CANCELLED") {
    return NextResponse.json({ error: "既にキャンセル済みです" }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: { items: true },
  });

  await logEdit({
    instanceId: instance.id,
    entityType: "ORDER",
    entityId: id,
    action: "CANCEL",
    summary: "注文をキャンセル",
    actorEmail: session?.user?.email,
  });

  return NextResponse.json(order);
}
