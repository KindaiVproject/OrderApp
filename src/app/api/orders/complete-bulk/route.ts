import { NextResponse } from "next/server";
import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "対象の注文を選択してください" }, { status: 400 });
  }

  await prisma.order.updateMany({
    where: { id: { in: ids }, instanceId: instance.id, status: "WAITING" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
