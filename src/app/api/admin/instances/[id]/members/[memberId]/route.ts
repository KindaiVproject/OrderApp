import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageMembers, isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { MEMBER_ROLE_MARKER, logEdit } from "@/lib/editLog";

const ROLE_LABELS = { admin: "インスタンス管理者", member: "一般" } as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await auth();
  const { id, memberId } = await params;
  const email = session?.user?.email;
  if (!(await canManageMembers(id, email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  // Instance admins can grant/revoke instance-admin; renaming members stays
  // a global-Admin-only action.
  const isGlobalAdmin = await isAdminEmail(email);

  const body = await request.json().catch(() => null);
  const data: { isInstanceAdmin?: boolean; displayName?: string | null } = {};
  if (typeof body?.isInstanceAdmin === "boolean") {
    data.isInstanceAdmin = body.isInstanceAdmin;
  }
  if (body?.displayName !== undefined) {
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: "表示名の変更は管理者のみ可能です" }, { status: 403 });
    }
    data.displayName = body.displayName === null ? null : String(body.displayName).trim() || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "更新する項目を指定してください" }, { status: 400 });
  }

  const member = await prisma.instanceMember.findFirst({ where: { id: memberId, instanceId: id } });
  if (!member) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isGlobalAdmin && data.isInstanceAdmin === false && member.email === email) {
    return NextResponse.json({ error: "自分自身の管理者権限は外せません" }, { status: 400 });
  }

  const updated = await prisma.instanceMember.update({
    where: { id: memberId },
    data,
    include: { user: true },
  });

  if (data.isInstanceAdmin !== undefined && data.isInstanceAdmin !== member.isInstanceAdmin) {
    await logEdit({
      instanceId: id,
      entityType: "MEMBER",
      entityId: memberId,
      action: "EDIT",
      summary: `${member.displayName ?? member.email}${MEMBER_ROLE_MARKER}${
        ROLE_LABELS[member.isInstanceAdmin ? "admin" : "member"]
      } → ${ROLE_LABELS[data.isInstanceAdmin ? "admin" : "member"]}`,
      actorEmail: session?.user?.email,
    });
  }

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
