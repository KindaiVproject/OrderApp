import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { SHIFT_NOTIFY_JOB } from "@/lib/jobs";
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
// cron is daily only). Besides shift notifications it also resumes instances
// whose scheduled reactivation time has passed. Sends the 30-minutes-before reminder (if the user kept
// it on) and the start-time notice, each at most once per assignment.
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  // Scheduled resume: stopped instances whose reactivation time has come go
  // back to active. Independent of push, so it runs even when push isn't set up.
  const resumed = await prisma.instance.updateMany({
    where: { active: false, reactivateAt: { lte: now } },
    data: { active: true, reactivateAt: null },
  });

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "push not configured", resumed: resumed.count }, { status: 503 });
  }

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

    // Claim first so overlapping cron calls can't double-send; if every
    // delivery then fails for a possibly transient reason, give the claim back
    // so the next minute's run retries (until the window closes).
    async function deliver(payload: { title: string; body: string }, release: () => Promise<unknown>) {
      const result = await sendPushToUser(user!.id, { ...payload, url: "/shifts" });
      if (result.sent === 0 && result.failed > 0) await release();
      return result.sent;
    }

    if (startsAt > now) {
      if (a.beforeNotifiedAt) continue;
      const claimed = await prisma.shiftAssignment.updateMany({
        where: { id: a.id, beforeNotifiedAt: null },
        data: { beforeNotifiedAt: now },
      });
      if (claimed.count === 0 || !user.shiftReminder30) continue;
      const mins = Math.ceil((startsAt.getTime() - now.getTime()) / 60_000);
      sent += await deliver({ title: `シフト開始の${mins}分前です`, body: detail }, () =>
        prisma.shiftAssignment.updateMany({ where: { id: a.id }, data: { beforeNotifiedAt: null } }),
      );
    } else {
      if (a.startNotifiedAt) continue;
      const claimed = await prisma.shiftAssignment.updateMany({
        where: { id: a.id, startNotifiedAt: null },
        data: { startNotifiedAt: now, ...(a.beforeNotifiedAt ? {} : { beforeNotifiedAt: now }) },
      });
      if (claimed.count === 0) continue;
      sent += await deliver({ title: "シフト開始です", body: detail }, () =>
        prisma.shiftAssignment.updateMany({ where: { id: a.id }, data: { startNotifiedAt: null } }),
      );
    }
  }

  // Heartbeat for the /admin status card.
  await prisma.jobRun.upsert({
    where: { name: SHIFT_NOTIFY_JOB },
    update: { ranAt: now, checked: assignments.length, sent },
    create: { name: SHIFT_NOTIFY_JOB, ranAt: now, checked: assignments.length, sent },
  });

  return NextResponse.json({ checked: assignments.length, sent, resumed: resumed.count });
}
