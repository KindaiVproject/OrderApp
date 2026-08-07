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
