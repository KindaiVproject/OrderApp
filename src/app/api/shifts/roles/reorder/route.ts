import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemberInstance, isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";

// Sets the display priority of an instance's shift roles: `ids` is the full
// list of the instance's role ids, first = highest priority (top of the table,
// first in the pick-list).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const instance = await getMemberInstance(typeof body?.instanceId === "string" ? body.instanceId : "");
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "役割の並び替えは管理者のみ可能です" }, { status: 403 });
  }

  const ids: unknown = body?.ids;
  const roles = await prisma.shiftRole.findMany({ where: { instanceId: instance.id } });
  const valid =
    Array.isArray(ids) &&
    ids.length === roles.length &&
    new Set(ids).size === ids.length &&
    ids.every((id) => roles.some((r) => r.id === id));
  if (!valid) return NextResponse.json({ error: "役割の指定が不正です" }, { status: 400 });

  await prisma.$transaction(
    (ids as string[]).map((id, index) =>
      prisma.shiftRole.update({ where: { id }, data: { sortOrder: index + 1 } }),
    ),
  );

  await logEdit({
    instanceId: instance.id,
    entityType: "SHIFT",
    entityId: instance.id,
    action: "EDIT",
    summary: `シフトの役割の並びを変更: ${(ids as string[])
      .map((id) => roles.find((r) => r.id === id)!.name)
      .join(" → ")}`,
    actorEmail: session?.user?.email,
  });
  return NextResponse.json({ ok: true });
}
