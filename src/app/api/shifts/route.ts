import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemberInstance, isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";
import { formatJstDateKey } from "@/lib/datetime";
import { formatShiftRange, parseShiftInput } from "@/lib/shifts";

// Creating/editing shifts is global-Admin only.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const instance = await getMemberInstance(typeof body?.instanceId === "string" ? body.instanceId : "");
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "シフトの追加は管理者のみ可能です" }, { status: 403 });
  }

  const members = await prisma.instanceMember.findMany({
    where: { instanceId: instance.id },
    select: { id: true },
  });
  const roles = await prisma.shiftRole.findMany({ where: { instanceId: instance.id } });
  const parsed = parseShiftInput(
    body,
    new Set(members.map((m) => m.id)),
    new Set(roles.map((r) => r.name)),
  );
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { startsAt, endsAt, assignments } = parsed.input;

  const shift = await prisma.shift.create({
    data: { instanceId: instance.id, startsAt, endsAt, assignments: { create: assignments } },
    include: { assignments: true },
  });

  await logEdit({
    instanceId: instance.id,
    entityType: "SHIFT",
    entityId: shift.id,
    action: "CREATE",
    summary: `シフトを追加: ${formatJstDateKey(startsAt)} ${formatShiftRange(startsAt, endsAt)}(${assignments.length}名)`,
    actorEmail: session?.user?.email,
  });

  return NextResponse.json(shift, { status: 201 });
}
