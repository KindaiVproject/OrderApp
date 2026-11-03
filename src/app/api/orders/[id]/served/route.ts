import { NextResponse } from "next/server";
import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

// Partial serving: record how many of one item's quantity have been handed
// over while the order is still waiting. Not written to the edit log (it
// happens on every tap during service); completing the order is still logged.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const servedQuantity = Number(body?.servedQuantity);
  if (typeof body?.itemId !== "string" || !Number.isInteger(servedQuantity) || servedQuantity < 0) {
    return NextResponse.json({ error: "指定が正しくありません" }, { status: 400 });
  }

  const item = await prisma.orderItem.findFirst({
    where: { id: body.itemId, orderId: id, order: { instanceId: instance.id, status: "WAITING" } },
  });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (servedQuantity > item.quantity) {
    return NextResponse.json({ error: "数量を超えています" }, { status: 400 });
  }

  await prisma.orderItem.update({ where: { id: item.id }, data: { servedQuantity } });
  return NextResponse.json({ ok: true, servedQuantity });
}
