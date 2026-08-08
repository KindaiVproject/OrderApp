import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.email !== getAdminEmail()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const data: { active?: boolean; name?: string; label?: string } = {};
  if (body?.active !== undefined) data.active = Boolean(body.active);
  if (body?.name !== undefined) data.name = String(body.name).trim();
  if (body?.label !== undefined) data.label = String(body.label).trim();

  const instance = await prisma.instance.update({ where: { id }, data });
  return NextResponse.json(instance);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.email !== getAdminEmail()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  // Cascades to the instance's products, orders, order items, and
  // memberships (see schema.prisma) — this permanently deletes that
  // stall's sales history. Callers must confirm before hitting this.
  await prisma.instance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
