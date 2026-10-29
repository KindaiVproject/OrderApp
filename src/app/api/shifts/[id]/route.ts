import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemberInstance, isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";
import { formatJstDateKey } from "@/lib/datetime";
import { formatShiftRange, parseShiftInput } from "@/lib/shifts";

// The shift's own instance decides access (not the "current instance"
// cookie), so the all-instances shift page can edit any instance's shifts.
async function authorize(shiftId: string) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return {
      error: NextResponse.json({ error: "シフトの編集は管理者のみ可能です" }, { status: 403 }),
    };
  }
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { assignments: true } });
  const instance = shift ? await getMemberInstance(shift.instanceId) : null;
  if (!shift || !instance) return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  return { instance, shift, email: session?.user?.email };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorize(id);
  if ("error" in authz) return authz.error;
  const { instance, email, shift: existing } = authz;

  const roles = await prisma.shiftRole.findMany({ where: { instanceId: instance.id } });
  const allowedRoles = new Set([...roles.map((r) => r.name), ...existing.assignments.map((a) => a.role)]);
  const members = await prisma.instanceMember.findMany({
    where: { instanceId: instance.id },
    select: { id: true },
  });
  const parsed = parseShiftInput(
    await request.json().catch(() => null),
    new Set(members.map((m) => m.id)),
    allowedRoles,
  );
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { startsAt, endsAt, assignments } = parsed.input;

  // Assignments are replaced wholesale, which also re-arms their reminders.
  const shift = await prisma.$transaction(async (tx) => {
    await tx.shiftAssignment.deleteMany({ where: { shiftId: id } });
    return tx.shift.update({
      where: { id },
      data: { startsAt, endsAt, assignments: { create: assignments } },
      include: { assignments: true },
    });
  });

  await logEdit({
    instanceId: instance.id,
    entityType: "SHIFT",
    entityId: id,
    action: "EDIT",
    summary: `シフトを編集: ${formatJstDateKey(startsAt)} ${formatShiftRange(startsAt, endsAt)}(${assignments.length}名)`,
    actorEmail: email,
  });

  return NextResponse.json(shift);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorize(id);
  if ("error" in authz) return authz.error;
  const { instance, email, shift: existing } = authz;

  await prisma.shift.delete({ where: { id } });
  await logEdit({
    instanceId: instance.id,
    entityType: "SHIFT",
    entityId: id,
    action: "DELETE",
    summary: `シフトを削除: ${formatJstDateKey(existing.startsAt)} ${formatShiftRange(existing.startsAt, existing.endsAt)}`,
    actorEmail: email,
  });
  return NextResponse.json({ ok: true });
}
