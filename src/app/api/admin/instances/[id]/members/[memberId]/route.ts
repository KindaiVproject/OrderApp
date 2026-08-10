import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id, memberId } = await params;

  const body = await request.json().catch(() => null);
  const data: { isInstanceAdmin?: boolean; displayName?: string | null } = {};
  if (typeof body?.isInstanceAdmin === "boolean") {
    data.isInstanceAdmin = body.isInstanceAdmin;
  }
  if (body?.displayName !== undefined) {
    data.displayName = body.displayName === null ? null : String(body.displayName).trim() || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "更新する項目を指定してください" }, { status: 400 });
  }

  const member = await prisma.instanceMember.findFirst({ where: { id: memberId, instanceId: id } });
  if (!member) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await prisma.instanceMember.update({
    where: { id: memberId },
    data,
    include: { user: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id, memberId } = await params;

  await prisma.instanceMember.deleteMany({ where: { id: memberId, instanceId: id } });
  return NextResponse.json({ ok: true });
}
