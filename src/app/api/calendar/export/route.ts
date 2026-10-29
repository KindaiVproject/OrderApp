import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildIcs, type IcsEvent } from "@/lib/ics";

// Builds an .ics file of the caller's upcoming shifts (all of their instances,
// stopped ones included, or just `instanceId`) and records them as "added to the calendar".
//  scope "unregistered": only shifts not yet exported (or changed since);
//  scope "all": every upcoming shift (safe to re-import: the event UID is
//  stable per shift+person, so calendars update events instead of duplicating).
// POST, not GET, because it changes state (marks the shifts as exported).
export async function POST(request: Request) {
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const scope = body?.scope === "all" ? "all" : "unregistered";
  const now = new Date();

  // Optionally only one instance's shifts (the per-instance shift screen).
  const instanceId = typeof body?.instanceId === "string" && body.instanceId ? body.instanceId : undefined;
  const upcoming = { member: { email }, shift: { endsAt: { gte: now }, ...(instanceId ? { instanceId } : {}) } };
  const wanted = await prisma.shiftAssignment.findMany({
    where: scope === "all" ? upcoming : { ...upcoming, calendarAddedAt: null },
    select: { shiftId: true },
  });
  if (wanted.length === 0) {
    return NextResponse.json({ error: "カレンダーに追加するシフトがありません" }, { status: 409 });
  }

  // A person can hold several roles in one shift: one event per shift, listing
  // every role they have in it.
  const assignments = await prisma.shiftAssignment.findMany({
    where: { member: { email }, shiftId: { in: [...new Set(wanted.map((a) => a.shiftId))] } },
    include: { shift: { include: { instance: true } } },
    orderBy: { shift: { startsAt: "asc" } },
  });

  const byShift = new Map<string, typeof assignments>();
  for (const a of assignments) byShift.set(a.shiftId, [...(byShift.get(a.shiftId) ?? []), a]);

  const events: IcsEvent[] = [...byShift.values()].map((list) => {
    const { shift, memberId } = list[0];
    const roles = list.map((a) => a.role);
    const where = shift.instance.label || shift.instance.name;
    return {
      uid: `shift-${shift.id}-${memberId}@orderapp`,
      start: shift.startsAt,
      end: shift.endsAt,
      summary: `シフト: ${roles.join("・")}(${where})`,
      description: `役割: ${roles.join("、")}\nインスタンス: ${shift.instance.name}`,
      location: shift.instance.name,
    };
  });

  await prisma.shiftAssignment.updateMany({
    where: { id: { in: assignments.map((a) => a.id) } },
    data: { calendarAddedAt: now },
  });

  return new Response(buildIcs(events, now), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="shifts.ics"',
      "X-Event-Count": String(events.length),
      "Cache-Control": "no-store",
    },
  });
}
