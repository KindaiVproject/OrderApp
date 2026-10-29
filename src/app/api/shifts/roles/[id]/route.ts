import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemberInstance, isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";

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
