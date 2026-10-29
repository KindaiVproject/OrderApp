import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canEditShifts, getMemberInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";
import { formatJstDateKey, formatJstTime } from "@/lib/datetime";
import { resolveName } from "@/lib/memberName";

// Changes ONE person's slot (time and/or role) — what dragging a bar on the
// schedule table does. A shift's time belongs to everybody on it, so:
//  - same time, new role: just the role changes;
//  - the person is alone on the shift: the shift itself is re-timed;
//  - others share the shift: this person moves to a new shift with the new time
//    and the others stay put.
// Times stay on the shift's own day (JST), so a drag can never cross midnight.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const assignment = await prisma.shiftAssignment.findUnique({
    where: { id },
    include: { shift: { include: { assignments: true } }, member: { include: { user: true } } },
  });
  const instance = assignment ? await getMemberInstance(assignment.shift.instanceId) : null;
  if (!assignment || !instance) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canEditShifts(instance.id, session?.user?.email))) {
    return NextResponse.json({ error: "シフトの編集はAdminまたはインスタンス管理者のみ可能です" }, { status: 403 });
  }
  const { shift } = assignment;

  const body = await request.json().catch(() => null);
  const start = typeof body?.start === "string" ? body.start : "";
  const end = typeof body?.end === "string" ? body.end : "";
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
    return NextResponse.json({ error: "開始・終了時刻を指定してください" }, { status: 400 });
  }
  const date = formatJstDateKey(shift.startsAt);
  const startsAt = new Date(`${date}T${start}:00+09:00`);
  const endsAt = new Date(`${date}T${end}:00+09:00`);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json({ error: "終了時刻は開始時刻より後にしてください" }, { status: 400 });
  }

  const role = typeof body?.role === "string" && body.role ? body.role : assignment.role;
  if (role !== assignment.role) {
    const roles = await prisma.shiftRole.findMany({ where: { instanceId: instance.id } });
    if (!roles.some((r) => r.name === role)) {
      return NextResponse.json({ error: "役割は登録済みのものから選んでください" }, { status: 400 });
    }
  }

  const sameTime =
    startsAt.getTime() === shift.startsAt.getTime() && endsAt.getTime() === shift.endsAt.getTime();
  if (sameTime && role === assignment.role) return NextResponse.json({ ok: true, unchanged: true });

  if (sameTime) {
    await prisma.shiftAssignment.update({ where: { id }, data: { role, calendarAddedAt: null } });
  } else if (shift.assignments.length === 1) {
    // Alone on the shift: re-time it. Reminders re-arm for the new time.
    await prisma.$transaction([
      prisma.shift.update({ where: { id: shift.id }, data: { startsAt, endsAt } }),
      prisma.shiftAssignment.update({
        where: { id },
        data: { role, beforeNotifiedAt: null, startNotifiedAt: null, calendarAddedAt: null },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.shiftAssignment.delete({ where: { id } }),
      prisma.shift.create({
        data: {
          instanceId: instance.id,
          startsAt,
          endsAt,
          assignments: { create: { memberId: assignment.memberId, role } },
        },
      }),
    ]);
  }

  const was = `${assignment.role} ${formatJstTime(shift.startsAt)}〜${formatJstTime(shift.endsAt)}`;
  const who = resolveName(assignment.member.email, assignment.member.displayName, assignment.member.user);
  await logEdit({
    instanceId: instance.id,
    entityType: "SHIFT",
    entityId: shift.id,
    action: "EDIT",
    summary: `${who} のシフトを変更(${date}): ${was} → ${role} ${start}〜${end}`,
    actorEmail: session?.user?.email,
  });
  return NextResponse.json({ ok: true });
}
