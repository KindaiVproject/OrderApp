import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemberInstance, isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";
import { SHIFT_COLOR_KEYS } from "@/lib/shiftColors";
import { MAX_ROLE_LENGTH } from "@/lib/shifts";

// Registering shift roles is global-Admin only, like the shifts themselves.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const instance = await getMemberInstance(typeof body?.instanceId === "string" ? body.instanceId : "");
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "役割の登録は管理者のみ可能です" }, { status: 403 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "役割名を入力してください" }, { status: 400 });
  if (name.length > MAX_ROLE_LENGTH) {
    return NextResponse.json({ error: `役割名は${MAX_ROLE_LENGTH}文字以内で入力してください` }, { status: 400 });
  }

  const color = typeof body?.color === "string" ? body.color : null;
  if (color && !SHIFT_COLOR_KEYS.includes(color)) {
    return NextResponse.json({ error: "色の指定が不正です" }, { status: 400 });
  }

  const existing = await prisma.shiftRole.findUnique({
    where: { instanceId_name: { instanceId: instance.id, name } },
  });
  if (existing) return NextResponse.json({ error: "その役割はすでに登録されています" }, { status: 409 });

  const max = await prisma.shiftRole.aggregate({
    where: { instanceId: instance.id },
    _max: { sortOrder: true },
  });
  const role = await prisma.shiftRole.create({
    data: { instanceId: instance.id, name, color, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });

  await logEdit({
    instanceId: instance.id,
    entityType: "SHIFT",
    entityId: role.id,
    action: "CREATE",
    summary: `シフトの役割「${name}」を登録`,
    actorEmail: session?.user?.email,
  });
  return NextResponse.json(role, { status: 201 });
}
