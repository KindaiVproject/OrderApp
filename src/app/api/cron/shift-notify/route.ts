import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatShiftRange } from "@/lib/shifts";
import { isPushConfigured, sendPushToUser } from "@/lib/webpush";

export const dynamic = "force-dynamic";

const REMINDER_MS = 30 * 60_000;
// A start-time notice that is this late is no longer useful.
const START_GRACE_MS = 15 * 60_000;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called every minute by an external scheduler (cron-job.org; Vercel Hobby
// cron is daily only). Sends the 30-minutes-before reminder (if the user kept
// it on) and the start-time notice, each at most once per assignment.
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: "push not configured" }, { status: 503 });

  const now = new Date();
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      shift: {
        startsAt: {
          gte: new Date(now.getTime() - START_GRACE_MS),
          lte: new Date(now.getTime() + REMINDER_MS),
        },
      },
      OR: [{ beforeNotifiedAt: null }, { startNotifiedAt: null }],
    },
    include: { shift: { include: { instance: true } }, member: { include: { user: true } } },
  });

  let sent = 0;
  for (const a of assignments) {
    const user = a.member.user;
    if (!user) continue; // not signed in yet, nothing to push to
    const { startsAt, endsAt, instance } = a.shift;
    const detail = `${a.role} ${formatShiftRange(startsAt, endsAt)}(${instance.label || instance.name})`;

    if (startsAt > now) {
      if (a.beforeNotifiedAt) continue;
      // Claim first so overlapping cron calls can't double-send.
      const claimed = await prisma.shiftAssignment.updateMany({
        where: { id: a.id, beforeNotifiedAt: null },
        data: { beforeNotifiedAt: now },
      });
      if (claimed.count === 0 || !user.shiftReminder30) continue;
      const mins = Math.ceil((startsAt.getTime() - now.getTime()) / 60_000);
      sent += await sendPushToUser(user.id, {
        title: `シフト開始の${mins}分前です`,
        body: detail,
        url: "/shifts",
      });
    } else {
      if (a.startNotifiedAt) continue;
      const claimed = await prisma.shiftAssignment.updateMany({
        where: { id: a.id, startNotifiedAt: null },
        data: { startNotifiedAt: now, ...(a.beforeNotifiedAt ? {} : { beforeNotifiedAt: now }) },
      });
      if (claimed.count === 0) continue;
      sent += await sendPushToUser(user.id, {
        title: "シフト開始です",
        body: detail,
        url: "/shifts",
      });
    }
  }

  return NextResponse.json({ checked: assignments.length, sent });
}
