import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemberInstance, isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";
import { MAX_ROLE_LENGTH } from "@/lib/shifts";

// Renaming also rewrites the role text on this instance's existing shifts
// (assignments store the name as plain text), so old and new shifts agree.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "役割の編集は管理者のみ可能です" }, { status: 403 });
  }
  const role = await prisma.shiftRole.findUnique({ where: { id } });
  const instance = role ? await getMemberInstance(role.instanceId) : null;
  if (!role || !instance) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "役割名を入力してください" }, { status: 400 });
  if (name.length > MAX_ROLE_LENGTH) {
    return NextResponse.json({ error: `役割名は${MAX_ROLE_LENGTH}文字以内で入力してください` }, { status: 400 });
  }
  if (name === role.name) return NextResponse.json(role);

  const clash = await prisma.shiftRole.findUnique({
    where: { instanceId_name: { instanceId: instance.id, name } },
  });
  if (clash) return NextResponse.json({ error: "その役割はすでに登録されています" }, { status: 409 });

  const [updated, renamed] = await prisma.$transaction([
    prisma.shiftRole.update({ where: { id }, data: { name } }),
    prisma.shiftAssignment.updateMany({
      where: { role: role.name, shift: { instanceId: instance.id } },
      data: { role: name },
    }),
  ]);

  await logEdit({
    instanceId: instance.id,
    entityType: "SHIFT",
    entityId: id,
    action: "EDIT",
    summary: `シフトの役割「${role.name}」を「${name}」に変更(設定済みのシフト${renamed.count}件も更新)`,
    actorEmail: session?.user?.email,
  });
  return NextResponse.json(updated);
}

// Existing shifts keep the role text; only the pick-list entry goes away.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "役割の削除は管理者のみ可能です" }, { status: 403 });
  }

  const role = await prisma.shiftRole.findUnique({ where: { id } });
  const instance = role ? await getMemberInstance(role.instanceId) : null;
  if (!role || !instance) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.shiftRole.delete({ where: { id } });
  await logEdit({
    instanceId: instance.id,
    entityType: "SHIFT",
    entityId: id,
    action: "DELETE",
    summary: `シフトの役割「${role.name}」を削除`,
    actorEmail: session?.user?.email,
  });
  return NextResponse.json({ ok: true });
}
